"""IP intelligence collector."""

import asyncio

import dns.asyncresolver
import dns.exception
import dns.resolver
import httpx

from app.core.settings import settings
from app.tools.domain_interrogator.collectors.base import BaseCollector
from app.tools.domain_interrogator.models import IpIntelInfo, IpIntelRecord


class IpIntelCollector(BaseCollector[IpIntelInfo]):
    """Collects IP intelligence information."""

    name = "ipintel"
    default_timeout = 5.0

    # API endpoints
    IPINFO_URL = "https://ipinfo.io/{ip}/json"
    IP_API_URL = "http://ip-api.com/json/{ip}"

    async def collect(self) -> IpIntelInfo:
        """Collect IP intelligence."""
        info = IpIntelInfo()

        # First, resolve the domain to get IP addresses
        ips = await self._resolve_domain_ips()
        if not ips:
            info.error = "Could not resolve domain to IP addresses"
            return info

        # Get intel for each IP (limit to first 5)
        tasks = [self._get_ip_intel(ip) for ip in ips[:5]]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for ip, result in zip(ips[:5], results, strict=False):
            if isinstance(result, Exception):
                # Add basic record with just the IP
                info.records.append(IpIntelRecord(ip=ip))
            elif result:
                info.records.append(result)

        return info

    async def _resolve_domain_ips(self) -> list[str]:
        """Resolve domain to IP addresses."""
        ips = []
        resolver = dns.asyncresolver.Resolver()
        resolver.timeout = 2.0
        resolver.lifetime = 3.0

        # Get IPv4 addresses
        try:
            answer = await resolver.resolve(self.domain, "A")
            ips.extend([str(rdata) for rdata in answer])
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.DNSException):
            pass

        # Get IPv6 addresses
        try:
            answer = await resolver.resolve(self.domain, "AAAA")
            ips.extend([str(rdata) for rdata in answer])
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.DNSException):
            pass

        return ips

    async def _get_ip_intel(self, ip: str) -> IpIntelRecord | None:
        """Get intelligence for a single IP address."""
        # Try ipinfo.io first (if token is configured)
        if settings.ipinfo_token:
            result = await self._query_ipinfo(ip)
            if result:
                return result

        # Fall back to ip-api.com
        return await self._query_ip_api(ip)

    async def _query_ipinfo(self, ip: str) -> IpIntelRecord | None:
        """Query ipinfo.io API."""
        try:
            url = self.IPINFO_URL.format(ip=ip)
            async with httpx.AsyncClient(
                timeout=settings.domain_intel_http_timeout_s
            ) as client:
                headers = {"Authorization": f"Bearer {settings.ipinfo_token}"}
                response = await client.get(url, headers=headers)

                if response.status_code != 200:
                    return None

                data = response.json()

                # Parse org field (format: "AS12345 Organization Name")
                org = data.get("org", "")
                asn = None
                org_name = org
                if org.startswith("AS"):
                    parts = org.split(" ", 1)
                    asn = parts[0]
                    org_name = parts[1] if len(parts) > 1 else None

                return IpIntelRecord(
                    ip=ip,
                    hostname=data.get("hostname"),
                    city=data.get("city"),
                    region=data.get("region"),
                    country=data.get("country"),
                    country_code=data.get("country"),
                    org=org_name,
                    asn=asn,
                    is_anycast=data.get("anycast", False),
                )
        except Exception:
            return None

    async def _query_ip_api(self, ip: str) -> IpIntelRecord | None:
        """Query ip-api.com API (free, rate-limited)."""
        try:
            url = self.IP_API_URL.format(ip=ip)
            async with httpx.AsyncClient(
                timeout=settings.domain_intel_http_timeout_s
            ) as client:
                response = await client.get(url)

                if response.status_code != 200:
                    return None

                data = response.json()

                if data.get("status") != "success":
                    return None

                return IpIntelRecord(
                    ip=ip,
                    hostname=data.get("reverse"),
                    city=data.get("city"),
                    region=data.get("regionName"),
                    country=data.get("country"),
                    country_code=data.get("countryCode"),
                    org=data.get("org"),
                    asn=data.get("as", "").split(" ")[0] if data.get("as") else None,
                    isp=data.get("isp"),
                )
        except Exception:
            return None
