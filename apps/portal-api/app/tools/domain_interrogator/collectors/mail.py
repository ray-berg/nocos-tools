"""Email configuration collector (MX, SPF, DMARC, MTA-STS, TLS-RPT)."""

import contextlib

import dns.asyncresolver
import dns.exception
import dns.resolver
import httpx

from app.core.settings import settings
from app.tools.domain_interrogator.collectors.base import BaseCollector
from app.tools.domain_interrogator.models import (
    DmarcInfo,
    MailInfo,
    MtaStsInfo,
    SpfInfo,
)


class MailCollector(BaseCollector[MailInfo]):
    """Collects email configuration information."""

    name = "mail"
    default_timeout = 5.0

    # SPF mechanisms that count toward the 10-lookup limit
    SPF_LOOKUP_MECHANISMS = {"include", "a", "mx", "ptr", "exists", "redirect"}

    async def collect(self) -> MailInfo:
        """Collect email configuration."""
        info = MailInfo()

        resolver = dns.asyncresolver.Resolver()
        resolver.timeout = 2.0
        resolver.lifetime = 3.0

        # Get MX records
        info.mx_records = await self._get_mx_records(resolver)

        # Get SPF record
        info.spf = await self._get_spf_info(resolver)

        # Get DMARC record
        info.dmarc = await self._get_dmarc_info(resolver)

        # Get MTA-STS
        info.mta_sts = await self._get_mta_sts_info(resolver)

        # Get TLS-RPT
        info.tls_rpt = await self._get_tls_rpt(resolver)

        return info

    async def _get_mx_records(self, resolver: dns.asyncresolver.Resolver) -> list[dict]:
        """Get MX records with preference."""
        mx_records = []
        try:
            answer = await resolver.resolve(self.domain, "MX")
            for rdata in answer:
                mx_records.append({
                    "preference": rdata.preference,
                    "exchange": str(rdata.exchange).rstrip("."),
                })
            # Sort by preference
            mx_records.sort(key=lambda x: x["preference"])
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            pass
        except dns.exception.DNSException:
            pass
        return mx_records

    async def _get_spf_info(self, resolver: dns.asyncresolver.Resolver) -> SpfInfo:
        """Get and parse SPF record."""
        spf = SpfInfo()

        try:
            answer = await resolver.resolve(self.domain, "TXT")
            for rdata in answer:
                txt_value = "".join([
                    s.decode() if isinstance(s, bytes) else s for s in rdata.strings
                ])
                if txt_value.lower().startswith("v=spf1"):
                    spf.record = txt_value
                    spf.exists = True
                    spf.is_valid = True  # Basic validation

                    # Parse mechanisms
                    spf.mechanisms = self._parse_spf_mechanisms(txt_value)

                    # Count DNS lookups
                    spf.lookup_count = self._count_spf_lookups(txt_value)
                    if spf.lookup_count > 10:
                        spf.warnings.append(
                            f"SPF exceeds 10-lookup limit ({spf.lookup_count} lookups)"
                        )

                    # Check 'all' mechanism
                    spf.all_mechanism = self._get_spf_all_mechanism(txt_value)
                    if spf.all_mechanism == "+all":
                        spf.warnings.append(
                            "SPF uses +all (permits all senders) - highly insecure"
                        )
                    elif spf.all_mechanism == "?all":
                        spf.warnings.append(
                            "SPF uses ?all (neutral) - provides no protection"
                        )

                    break
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            pass
        except dns.exception.DNSException:
            pass

        return spf

    def _parse_spf_mechanisms(self, spf_record: str) -> list[str]:
        """Parse SPF mechanisms from record."""
        mechanisms = []
        parts = spf_record.split()
        for part in parts[1:]:  # Skip v=spf1
            mechanisms.append(part)
        return mechanisms

    def _count_spf_lookups(self, spf_record: str) -> int:
        """Count DNS lookups in SPF record."""
        count = 0
        parts = spf_record.lower().split()
        for part in parts:
            # Remove qualifier if present
            if part and part[0] in "+-~?":
                part = part[1:]
            # Check if it's a lookup mechanism
            for mechanism in self.SPF_LOOKUP_MECHANISMS:
                if part.startswith(mechanism):
                    count += 1
                    break
        return count

    def _get_spf_all_mechanism(self, spf_record: str) -> str | None:
        """Get the 'all' mechanism from SPF record."""
        parts = spf_record.lower().split()
        for part in parts:
            if part.endswith("all"):
                return part
        return None

    async def _get_dmarc_info(self, resolver: dns.asyncresolver.Resolver) -> DmarcInfo:
        """Get and parse DMARC record."""
        dmarc = DmarcInfo()

        try:
            dmarc_domain = f"_dmarc.{self.domain}"
            answer = await resolver.resolve(dmarc_domain, "TXT")
            for rdata in answer:
                txt_value = "".join([
                    s.decode() if isinstance(s, bytes) else s for s in rdata.strings
                ])
                if txt_value.lower().startswith("v=dmarc1"):
                    dmarc.record = txt_value
                    dmarc.exists = True

                    # Parse DMARC tags
                    tags = self._parse_dmarc_tags(txt_value)

                    dmarc.policy = tags.get("p")
                    dmarc.subdomain_policy = tags.get("sp")
                    if "pct" in tags:
                        with contextlib.suppress(ValueError):
                            dmarc.pct = int(tags["pct"])
                    if "rua" in tags:
                        dmarc.rua = [addr.strip() for addr in tags["rua"].split(",")]
                    if "ruf" in tags:
                        dmarc.ruf = [addr.strip() for addr in tags["ruf"].split(",")]

                    # Add warnings
                    if dmarc.policy == "none":
                        dmarc.warnings.append(
                            "DMARC policy is 'none' - monitoring only, no enforcement"
                        )
                    if not dmarc.rua:
                        dmarc.warnings.append(
                            "No aggregate report recipients (rua) configured"
                        )

                    break
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            pass
        except dns.exception.DNSException:
            pass

        return dmarc

    def _parse_dmarc_tags(self, dmarc_record: str) -> dict[str, str]:
        """Parse DMARC tags from record."""
        tags = {}
        # Split by semicolon and parse key=value pairs
        parts = dmarc_record.split(";")
        for part in parts:
            part = part.strip()
            if "=" in part:
                key, value = part.split("=", 1)
                tags[key.strip().lower()] = value.strip()
        return tags

    async def _get_mta_sts_info(self, resolver: dns.asyncresolver.Resolver) -> MtaStsInfo:
        """Get MTA-STS information."""
        mta_sts = MtaStsInfo()

        # Check for MTA-STS DNS record
        try:
            sts_domain = f"_mta-sts.{self.domain}"
            answer = await resolver.resolve(sts_domain, "TXT")
            for rdata in answer:
                txt_value = "".join([
                    s.decode() if isinstance(s, bytes) else s for s in rdata.strings
                ])
                if "v=STSv1" in txt_value:
                    mta_sts.exists = True
                    break
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.DNSException):
            return mta_sts

        # If DNS record exists, try to fetch the policy
        if mta_sts.exists:
            try:
                policy_url = f"https://mta-sts.{self.domain}/.well-known/mta-sts.txt"
                timeout = settings.domain_intel_http_timeout_s
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.get(policy_url, follow_redirects=True)
                    if response.status_code == 200:
                        policy = self._parse_mta_sts_policy(response.text)
                        mta_sts.mode = policy.get("mode")
                        mta_sts.mx_hosts = policy.get("mx", [])
                        if "max_age" in policy:
                            with contextlib.suppress(ValueError):
                                mta_sts.max_age = int(policy["max_age"])
            except Exception as e:
                mta_sts.error = f"Failed to fetch MTA-STS policy: {str(e)}"

        return mta_sts

    def _parse_mta_sts_policy(self, policy_text: str) -> dict:
        """Parse MTA-STS policy file."""
        policy: dict = {"mx": []}
        for line in policy_text.strip().split("\n"):
            line = line.strip()
            if ":" in line:
                key, value = line.split(":", 1)
                key = key.strip().lower()
                value = value.strip()
                if key == "mx":
                    policy["mx"].append(value)
                else:
                    policy[key] = value
        return policy

    async def _get_tls_rpt(self, resolver: dns.asyncresolver.Resolver) -> str | None:
        """Get TLS-RPT record."""
        try:
            tls_rpt_domain = f"_smtp._tls.{self.domain}"
            answer = await resolver.resolve(tls_rpt_domain, "TXT")
            for rdata in answer:
                txt_value = "".join([
                    s.decode() if isinstance(s, bytes) else s for s in rdata.strings
                ])
                if "v=TLSRPTv1" in txt_value:
                    return txt_value
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.DNSException):
            pass
        return None
