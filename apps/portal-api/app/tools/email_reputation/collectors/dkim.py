"""DKIM collector for email reputation analysis."""

import asyncio
import base64
import re

import dns.asyncresolver
import dns.resolver

from app.tools.email_reputation.collectors.base import BaseCollector
from app.tools.email_reputation.models import DkimInfo, DkimSelector, DkimStatus


class DkimCollector(BaseCollector[DkimInfo]):
    """Collector for DKIM selector discovery and analysis."""

    name = "dkim"
    default_timeout = 8.0

    # Common DKIM selectors to check
    COMMON_SELECTORS = [
        "selector1",  # Microsoft 365
        "selector2",  # Microsoft 365
        "google",  # Google Workspace
        "default",  # Common default
        "dkim",  # Common
        "mail",  # Common
        "k1",  # Mailchimp
        "s1",  # Generic
        "s2",  # Generic
        "smtp",  # Common
        "email",  # Common
        "mta",  # Common
        "20230601",  # Date-based (Google style)
        "proofpoint",  # Proofpoint
        "pp1",  # Proofpoint
        "mimecast",  # Mimecast
        "sendgrid",  # SendGrid
        "amazonses",  # AWS SES
    ]

    async def collect(self) -> DkimInfo:
        """Collect and analyze DKIM selectors."""
        info = DkimInfo()
        info.selectors_checked = self.COMMON_SELECTORS.copy()
        issues: list[str] = []

        resolver = dns.asyncresolver.Resolver()
        resolver.timeout = 1.5
        resolver.lifetime = 2.0

        # Check all selectors concurrently
        tasks = [
            self._check_selector(resolver, selector)
            for selector in self.COMMON_SELECTORS
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for _selector, result in zip(self.COMMON_SELECTORS, results, strict=False):
            if isinstance(result, Exception):
                continue
            if result is not None:
                info.selectors_found.append(result)

        # Determine status
        if len(info.selectors_found) > 0:
            info.status = DkimStatus.PRESENT

            # Check for weak keys
            for sel in info.selectors_found:
                if sel.weak_key:
                    issues.append(
                        f"Selector '{sel.selector}' uses weak {sel.key_bits}-bit key"
                    )
        else:
            # No selectors found - could still exist with non-standard names
            info.status = DkimStatus.UNKNOWN
            issues.append(
                "No DKIM selectors found at common names (may exist with custom selector)"
            )

        info.issues = issues
        return info

    async def _check_selector(
        self, resolver: dns.asyncresolver.Resolver, selector: str
    ) -> DkimSelector | None:
        """Check a single DKIM selector."""
        dkim_domain = f"{selector}._domainkey.{self.domain}"

        try:
            answers = await resolver.resolve(dkim_domain, "TXT")

            for rdata in answers:
                txt = b"".join(rdata.strings).decode("utf-8", errors="ignore")
                if "v=DKIM1" in txt or "k=" in txt:
                    return self._parse_dkim_record(selector, txt)

            return None

        except (
            dns.resolver.NXDOMAIN,
            dns.resolver.NoAnswer,
            dns.resolver.NoNameservers,
        ):
            return None
        except Exception:
            return None

    def _parse_dkim_record(self, selector: str, record: str) -> DkimSelector:
        """Parse a DKIM record and extract key information."""
        result = DkimSelector(selector=selector)

        # Parse key type
        key_match = re.search(r"k=([^;]+)", record)
        if key_match:
            result.key_type = key_match.group(1).strip()
        else:
            result.key_type = "rsa"  # Default per RFC

        # Parse public key and estimate bit length
        p_match = re.search(r"p=([^;]+)", record)
        if p_match:
            key_b64 = p_match.group(1).strip().replace(" ", "")
            if key_b64:
                try:
                    key_bytes = base64.b64decode(key_b64)
                    # Estimate key size from decoded length
                    # RSA keys: rough estimate is len * 8 bits, but actual
                    # key size depends on ASN.1 structure
                    key_len = len(key_bytes)
                    if key_len <= 128:
                        result.key_bits = 1024
                    elif key_len <= 256:
                        result.key_bits = 2048
                    else:
                        result.key_bits = 4096

                    # Warn on 1024-bit keys
                    if result.key_bits <= 1024:
                        result.weak_key = True
                except Exception:
                    pass

        return result
