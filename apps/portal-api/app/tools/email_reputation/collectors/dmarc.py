"""DMARC collector for email reputation analysis."""

import dns.asyncresolver
import dns.resolver

from app.tools.email_reputation.collectors.base import BaseCollector
from app.tools.email_reputation.models import DmarcInfo, DmarcStatus


class DmarcCollector(BaseCollector[DmarcInfo]):
    """Collector for DMARC policy analysis."""

    name = "dmarc"
    default_timeout = 5.0

    async def collect(self) -> DmarcInfo:
        """Collect and analyze DMARC record."""
        resolver = dns.asyncresolver.Resolver()
        resolver.timeout = 2.0
        resolver.lifetime = 3.0

        info = DmarcInfo()
        issues: list[str] = []

        dmarc_domain = f"_dmarc.{self.domain}"

        try:
            answers = await resolver.resolve(dmarc_domain, "TXT")

            dmarc_records = []
            for rdata in answers:
                txt = b"".join(rdata.strings).decode("utf-8", errors="ignore")
                if txt.startswith("v=DMARC1"):
                    dmarc_records.append(txt)

            if not dmarc_records:
                info.exists = False
                info.status = DmarcStatus.ABSENT
                issues.append("No DMARC record found")
                info.issues = issues
                return info

            if len(dmarc_records) > 1:
                issues.append("Multiple DMARC records found (should have only one)")

            info.record = dmarc_records[0]
            info.exists = True

            # Parse DMARC tags
            tags = self._parse_tags(info.record)

            # Extract policy
            info.policy = tags.get("p")
            info.subdomain_policy = tags.get("sp")
            info.alignment_dkim = tags.get("adkim", "r")  # Default relaxed
            info.alignment_spf = tags.get("aspf", "r")  # Default relaxed

            # Extract percentage
            pct_str = tags.get("pct", "100")
            try:
                info.pct = int(pct_str)
            except ValueError:
                info.pct = 100

            # Extract report URIs
            if "rua" in tags:
                info.rua = [uri.strip() for uri in tags["rua"].split(",")]
            if "ruf" in tags:
                info.ruf = [uri.strip() for uri in tags["ruf"].split(",")]

            # Determine status based on policy
            if info.policy == "reject":
                info.status = DmarcStatus.STRICT
            elif info.policy == "quarantine":
                info.status = DmarcStatus.ENFORCING
            elif info.policy == "none":
                info.status = DmarcStatus.MONITORING
                issues.append("DMARC policy is 'none' - monitoring only, no enforcement")
            else:
                info.status = DmarcStatus.ABSENT
                issues.append(f"Invalid or missing DMARC policy: {info.policy}")

            # Check for issues
            if not info.rua:
                issues.append("No aggregate report recipients (rua) configured")

            if info.pct < 100:
                issues.append(
                    f"DMARC policy only applies to {info.pct}% of messages"
                )

            if info.alignment_dkim == "s" and info.alignment_spf == "s":
                # Strict alignment on both - could cause issues
                pass  # This is actually good for security
            elif info.alignment_dkim == "r" and info.alignment_spf == "r":
                # Relaxed alignment - more permissive
                pass

            info.issues = issues
            return info

        except dns.resolver.NXDOMAIN:
            info.exists = False
            info.status = DmarcStatus.ABSENT
            issues.append("DMARC domain does not exist")
            info.issues = issues
            return info
        except dns.resolver.NoAnswer:
            info.exists = False
            info.status = DmarcStatus.ABSENT
            issues.append("No DMARC TXT record found")
            info.issues = issues
            return info
        except dns.resolver.NoNameservers:
            info.exists = False
            info.status = DmarcStatus.ABSENT
            issues.append("No nameservers available for DMARC query")
            info.issues = issues
            return info
        except Exception as e:
            info.exists = False
            info.status = DmarcStatus.ABSENT
            issues.append(f"DMARC query failed: {e}")
            info.issues = issues
            return info

    def _parse_tags(self, record: str) -> dict[str, str]:
        """Parse DMARC record tags into a dictionary."""
        tags = {}
        parts = record.split(";")

        for part in parts:
            part = part.strip()
            if "=" in part:
                key, value = part.split("=", 1)
                tags[key.strip().lower()] = value.strip()

        return tags
