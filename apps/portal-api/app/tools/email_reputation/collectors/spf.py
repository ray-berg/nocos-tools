"""SPF collector for email reputation analysis."""

import dns.asyncresolver
import dns.resolver

from app.tools.email_reputation.collectors.base import BaseCollector
from app.tools.email_reputation.models import SpfInfo, SpfStatus


class SpfCollector(BaseCollector[SpfInfo]):
    """Collector for SPF record analysis."""

    name = "spf"
    default_timeout = 5.0

    # Mechanisms that require DNS lookups
    LOOKUP_MECHANISMS = {"include", "a", "mx", "ptr", "exists", "redirect"}

    async def collect(self) -> SpfInfo:
        """Collect and analyze SPF record."""
        resolver = dns.asyncresolver.Resolver()
        resolver.timeout = 2.0
        resolver.lifetime = 3.0

        info = SpfInfo()
        issues: list[str] = []

        try:
            # Query TXT records
            answers = await resolver.resolve(self.domain, "TXT")
            spf_records = []

            for rdata in answers:
                txt = b"".join(rdata.strings).decode("utf-8", errors="ignore")
                if txt.startswith("v=spf1"):
                    spf_records.append(txt)

            if not spf_records:
                info.exists = False
                info.status = SpfStatus.BROKEN
                issues.append("No SPF record found")
                info.issues = issues
                return info

            # Check for multiple SPF records (RFC violation)
            if len(spf_records) > 1:
                info.has_multiple_records = True
                info.status = SpfStatus.BROKEN
                issues.append("Multiple SPF records found (RFC 7208 violation)")

            info.record = spf_records[0]
            info.exists = True

            # Parse mechanisms
            info.mechanisms = self._parse_mechanisms(info.record)
            info.lookup_count = self._count_lookups(info.record)
            info.all_mechanism = self._get_all_mechanism(info.record)
            info.has_redirect = self._has_redirect(info.record)

            # Analyze for issues
            if info.lookup_count > 10:
                issues.append(
                    f"SPF exceeds 10 DNS lookup limit ({info.lookup_count} lookups)"
                )
                info.status = SpfStatus.BROKEN
            elif info.lookup_count >= 8:
                issues.append(
                    f"SPF approaching 10 DNS lookup limit ({info.lookup_count} lookups)"
                )
                if info.status != SpfStatus.BROKEN:
                    info.status = SpfStatus.FRAGILE

            if info.all_mechanism == "+all":
                issues.append("SPF uses +all - permits any sender (no protection)")
                info.status = SpfStatus.BROKEN
            elif info.all_mechanism == "?all":
                issues.append("SPF uses ?all - neutral result (no protection)")
                if info.status != SpfStatus.BROKEN:
                    info.status = SpfStatus.FRAGILE
            elif info.all_mechanism == "~all" or info.all_mechanism == "-all":
                if info.status not in (SpfStatus.BROKEN, SpfStatus.FRAGILE):
                    info.status = SpfStatus.PASSABLE
            elif info.all_mechanism is None:
                issues.append("SPF record missing 'all' mechanism")
                if info.status != SpfStatus.BROKEN:
                    info.status = SpfStatus.FRAGILE

            # Check for redirect issues
            if info.has_redirect and info.all_mechanism:
                issues.append(
                    "SPF has both redirect and all mechanism (redirect may be ignored)"
                )

            info.issues = issues
            return info

        except dns.resolver.NXDOMAIN:
            info.exists = False
            info.status = SpfStatus.BROKEN
            issues.append("Domain does not exist (NXDOMAIN)")
            info.issues = issues
            return info
        except dns.resolver.NoAnswer:
            info.exists = False
            info.status = SpfStatus.BROKEN
            issues.append("No TXT records found")
            info.issues = issues
            return info
        except dns.resolver.NoNameservers:
            info.exists = False
            info.status = SpfStatus.BROKEN
            issues.append("No nameservers available")
            info.issues = issues
            return info
        except Exception as e:
            info.exists = False
            info.status = SpfStatus.BROKEN
            issues.append(f"DNS query failed: {e}")
            info.issues = issues
            return info

    def _parse_mechanisms(self, record: str) -> list[str]:
        """Parse SPF mechanisms from record."""
        parts = record.split()
        mechanisms = []
        for part in parts[1:]:  # Skip v=spf1
            mechanisms.append(part)
        return mechanisms

    def _count_lookups(self, record: str) -> int:
        """Count DNS lookups required by SPF record."""
        parts = record.lower().split()
        count = 0

        for part in parts:
            # Remove qualifier if present
            if part[0] in "+-~?":
                part = part[1:]

            # Extract mechanism name
            mechanism = part.split(":")[0].split("/")[0]

            if mechanism in self.LOOKUP_MECHANISMS:
                count += 1

        return count

    def _get_all_mechanism(self, record: str) -> str | None:
        """Extract the 'all' mechanism from SPF record."""
        parts = record.lower().split()

        for part in parts:
            # Could be +all, -all, ~all, ?all, or just all
            if part.endswith("all") and part in ("all", "+all", "-all", "~all", "?all"):
                return part if part != "all" else "+all"

        return None

    def _has_redirect(self, record: str) -> bool:
        """Check if SPF record has redirect modifier."""
        return "redirect=" in record.lower()
