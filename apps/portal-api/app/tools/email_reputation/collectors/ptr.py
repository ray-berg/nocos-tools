"""PTR collector for email reputation analysis."""

import ipaddress

import dns.asyncresolver
import dns.resolver
import dns.reversename

from app.tools.email_reputation.collectors.base import BaseCollector
from app.tools.email_reputation.models import PtrInfo, PtrStatus


class PtrCollector(BaseCollector[PtrInfo]):
    """Collector for PTR (reverse DNS) and FCrDNS analysis."""

    name = "ptr"
    default_timeout = 5.0

    def __init__(self, domain: str, sending_ip: str, timeout: float | None = None):
        """
        Initialize PTR collector.

        Args:
            domain: The sending domain.
            sending_ip: The sending IP to check.
            timeout: Timeout in seconds.
        """
        super().__init__(domain, timeout)
        self.sending_ip = sending_ip

    async def collect(self) -> PtrInfo:
        """Collect and analyze PTR record."""
        resolver = dns.asyncresolver.Resolver()
        resolver.timeout = 2.0
        resolver.lifetime = 3.0

        info = PtrInfo()
        issues: list[str] = []

        try:
            # Validate IP address
            ip_obj = ipaddress.ip_address(self.sending_ip)

            # Get reverse DNS name
            rev_name = dns.reversename.from_address(self.sending_ip)

            # Query PTR record
            try:
                answers = await resolver.resolve(rev_name, "PTR")
                if answers:
                    ptr_hostname = str(answers[0].target).rstrip(".")
                    info.ptr_hostname = ptr_hostname

                    # Now do forward lookup to verify FCrDNS
                    info.forward_ips = await self._forward_lookup(
                        resolver, ptr_hostname, ip_obj
                    )

                    # Check FCrDNS validity
                    if self.sending_ip in info.forward_ips:
                        info.fcrdns_valid = True
                        info.status = PtrStatus.ALIGNED
                    else:
                        info.fcrdns_valid = False
                        info.status = PtrStatus.EXISTS_MISMATCHED
                        issues.append(
                            f"PTR hostname '{ptr_hostname}' does not resolve "
                            f"back to {self.sending_ip}"
                        )

                else:
                    info.status = PtrStatus.MISSING
                    issues.append(f"No PTR record found for {self.sending_ip}")

            except dns.resolver.NXDOMAIN:
                info.status = PtrStatus.MISSING
                issues.append(f"No reverse DNS zone for {self.sending_ip}")
            except dns.resolver.NoAnswer:
                info.status = PtrStatus.MISSING
                issues.append(f"No PTR record found for {self.sending_ip}")
            except dns.resolver.NoNameservers:
                info.status = PtrStatus.MISSING
                issues.append("No nameservers available for PTR query")

        except ValueError as e:
            info.status = PtrStatus.MISSING
            issues.append(f"Invalid IP address: {e}")
        except Exception as e:
            info.status = PtrStatus.MISSING
            issues.append(f"PTR lookup failed: {e}")

        info.issues = issues
        return info

    async def _forward_lookup(
        self,
        resolver: dns.asyncresolver.Resolver,
        hostname: str,
        original_ip: ipaddress.IPv4Address | ipaddress.IPv6Address,
    ) -> list[str]:
        """Perform forward lookup on PTR hostname."""
        ips = []

        # Determine record type based on original IP
        record_type = "A" if isinstance(original_ip, ipaddress.IPv4Address) else "AAAA"

        try:
            answers = await resolver.resolve(hostname, record_type)
            for rdata in answers:
                ips.append(str(rdata.address))
        except Exception:
            pass

        return ips
