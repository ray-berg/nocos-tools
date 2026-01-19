"""DNS records and delegation collector."""

import asyncio

import dns.asyncresolver
import dns.exception
import dns.name
import dns.rdatatype
import dns.resolver

from app.tools.domain_interrogator.collectors.base import BaseCollector
from app.tools.domain_interrogator.models import DelegationInfo, DnsInfo, DnsRecord


class DnsCollector(BaseCollector[DnsInfo]):
    """Collects DNS records and delegation information."""

    name = "dns"
    default_timeout = 5.0

    # Record types to query
    RECORD_TYPES = ["A", "AAAA", "CNAME", "NS", "SOA", "TXT"]

    async def collect(self) -> DnsInfo:
        """Collect DNS records and delegation info."""
        records: list[DnsRecord] = []
        errors: list[str] = []

        # Query each record type
        resolver = dns.asyncresolver.Resolver()
        resolver.timeout = 2.0
        resolver.lifetime = 3.0

        tasks = [
            self._query_record_type(resolver, rtype)
            for rtype in self.RECORD_TYPES
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for rtype, result in zip(self.RECORD_TYPES, results, strict=False):
            if isinstance(result, Exception):
                if not isinstance(result, (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer)):
                    errors.append(f"{rtype}: {str(result)}")
            elif result:
                records.extend(result)

        # Get delegation info
        delegation = await self._get_delegation_info(resolver)

        return DnsInfo(
            records=records,
            delegation=delegation,
            error="; ".join(errors) if errors else None,
        )

    async def _query_record_type(
        self, resolver: dns.asyncresolver.Resolver, rtype: str
    ) -> list[DnsRecord]:
        """Query a specific record type."""
        records = []
        try:
            answer = await resolver.resolve(self.domain, rtype)
            for rdata in answer:
                records.append(
                    DnsRecord(
                        name=str(answer.name),
                        type=rtype,
                        ttl=answer.ttl,
                        value=str(rdata),
                    )
                )
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            pass
        except dns.exception.DNSException as e:
            raise e
        return records

    async def _get_delegation_info(
        self, resolver: dns.asyncresolver.Resolver
    ) -> DelegationInfo:
        """Get delegation information including NS records and check for lame delegation."""
        delegation = DelegationInfo()

        try:
            # Get NS records
            ns_answer = await resolver.resolve(self.domain, "NS")
            delegation.nameservers = [str(ns.target) for ns in ns_answer]

            # Get IP addresses for each nameserver
            for ns in delegation.nameservers:
                ips = []
                try:
                    a_answer = await resolver.resolve(ns, "A")
                    ips.extend([str(rdata) for rdata in a_answer])
                except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.DNSException):
                    pass

                try:
                    aaaa_answer = await resolver.resolve(ns, "AAAA")
                    ips.extend([str(rdata) for rdata in aaaa_answer])
                except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.DNSException):
                    pass

                if ips:
                    delegation.ns_ips[ns] = ips

            # Check for lame delegation
            lame_ns = await self._check_lame_delegation(delegation.nameservers)
            if lame_ns:
                delegation.is_lame = True
                delegation.lame_ns = lame_ns

        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            pass
        except dns.exception.DNSException:
            pass

        return delegation

    async def _check_lame_delegation(self, nameservers: list[str]) -> list[str]:
        """Check which nameservers are lame (don't respond authoritatively)."""
        lame = []

        for ns in nameservers[:4]:  # Limit to first 4 NS to avoid timeout
            try:
                # Try to query the domain directly at this nameserver
                ns_resolver = dns.asyncresolver.Resolver()
                ns_resolver.timeout = 1.5
                ns_resolver.lifetime = 2.0

                # Get NS IP first
                try:
                    ns_ips = await ns_resolver.resolve(ns, "A")
                    if ns_ips:
                        ns_resolver.nameservers = [str(ns_ips[0])]

                        # Query SOA for the domain
                        try:
                            await ns_resolver.resolve(self.domain, "SOA")
                        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
                            # No authoritative answer - lame
                            lame.append(ns)
                        except dns.exception.DNSException:
                            # Connection failed - possibly lame
                            lame.append(ns)
                except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.DNSException):
                    pass
            except Exception:
                pass

        return lame
