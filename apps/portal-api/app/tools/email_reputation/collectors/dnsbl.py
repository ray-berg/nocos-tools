"""DNSBL collector for email reputation analysis."""

import asyncio
import ipaddress

import dns.asyncresolver
import dns.resolver

from app.core.settings import settings
from app.tools.email_reputation.collectors.base import BaseCollector
from app.tools.email_reputation.models import DnsblInfo, DnsblListing


class DnsblCollector(BaseCollector[DnsblInfo]):
    """Collector for DNSBL (DNS Blacklist) checks."""

    name = "dnsbl"
    default_timeout = 10.0

    # IP-based DNSBLs
    IP_DNSBLS = [
        ("zen.spamhaus.org", "Spamhaus ZEN (SBL+XBL+PBL)"),
        ("b.barracudacentral.org", "Barracuda Reputation"),
        ("bl.spamcop.net", "SpamCop"),
        ("dnsbl.sorbs.net", "SORBS DNSBL"),
    ]

    # Domain-based DNSBLs
    DOMAIN_DNSBLS = [
        ("dbl.spamhaus.org", "Spamhaus DBL"),
        ("multi.surbl.org", "SURBL"),
    ]

    # Return code meanings for Spamhaus ZEN
    SPAMHAUS_ZEN_CODES = {
        "127.0.0.2": "SBL - Spamhaus Block List",
        "127.0.0.3": "SBL CSS - Spamhaus CSS",
        "127.0.0.4": "XBL - CBL (Exploits)",
        "127.0.0.5": "XBL - CBL (Exploits)",
        "127.0.0.6": "XBL - CBL (Exploits)",
        "127.0.0.7": "XBL - CBL (Exploits)",
        "127.0.0.10": "PBL - ISP Maintained",
        "127.0.0.11": "PBL - Spamhaus Maintained",
    }

    # Return code meanings for Spamhaus DBL
    SPAMHAUS_DBL_CODES = {
        "127.0.1.2": "spam domain",
        "127.0.1.4": "phishing domain",
        "127.0.1.5": "malware domain",
        "127.0.1.6": "botnet C&C domain",
        "127.0.1.102": "abused legit spam",
        "127.0.1.103": "abused spammed redirector",
        "127.0.1.104": "abused legit phishing",
        "127.0.1.105": "abused legit malware",
        "127.0.1.106": "abused legit botnet C&C",
    }

    def __init__(
        self, domain: str, sending_ip: str | None = None, timeout: float | None = None
    ):
        """
        Initialize DNSBL collector.

        Args:
            domain: The sending domain.
            sending_ip: Optional sending IP for IP-based checks.
            timeout: Timeout in seconds.
        """
        super().__init__(domain, timeout)
        self.sending_ip = sending_ip

    async def collect(self) -> DnsblInfo:
        """Collect DNSBL listings."""
        info = DnsblInfo()
        issues: list[str] = []

        resolver = dns.asyncresolver.Resolver()
        resolver.timeout = settings.email_rep_dnsbl_timeout_s
        resolver.lifetime = settings.email_rep_dnsbl_timeout_s + 1.0

        tasks = []

        # Check IP-based DNSBLs if IP provided
        if self.sending_ip:
            try:
                ip_obj = ipaddress.ip_address(self.sending_ip)
                if isinstance(ip_obj, ipaddress.IPv4Address):
                    reversed_ip = ".".join(reversed(self.sending_ip.split(".")))
                    for zone, description in self.IP_DNSBLS:
                        tasks.append(
                            self._check_ip_dnsbl(resolver, reversed_ip, zone, description)
                        )
            except ValueError:
                issues.append(f"Invalid IP address: {self.sending_ip}")

        # Check domain-based DNSBLs
        for zone, description in self.DOMAIN_DNSBLS:
            tasks.append(
                self._check_domain_dnsbl(resolver, self.domain, zone, description)
            )

        # Run all checks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, Exception):
                continue
            if result is None:
                continue

            listing, is_ip_based = result
            if is_ip_based:
                info.ip_listings.append(listing)
            else:
                info.domain_listings.append(listing)

            if listing.listed:
                info.total_listings += 1

        # Generate issues for listings
        for listing in info.ip_listings:
            if listing.listed:
                meaning = listing.meaning or "listed"
                issues.append(f"IP listed on {listing.zone}: {meaning}")

        for listing in info.domain_listings:
            if listing.listed:
                meaning = listing.meaning or "listed"
                issues.append(f"Domain listed on {listing.zone}: {meaning}")

        info.issues = issues
        return info

    async def _check_ip_dnsbl(
        self,
        resolver: dns.asyncresolver.Resolver,
        reversed_ip: str,
        zone: str,
        description: str,
    ) -> tuple[DnsblListing, bool] | None:
        """Check IP against a DNSBL."""
        query = f"{reversed_ip}.{zone}"
        listing = DnsblListing(zone=zone)

        try:
            answers = await resolver.resolve(query, "A")
            if answers:
                listing.listed = True
                return_code = str(answers[0].address)
                listing.return_code = return_code

                # Get meaning based on return code
                if zone == "zen.spamhaus.org":
                    listing.meaning = self.SPAMHAUS_ZEN_CODES.get(
                        return_code, f"{description} ({return_code})"
                    )
                else:
                    listing.meaning = f"{description} ({return_code})"

                return (listing, True)
            else:
                listing.listed = False
                return (listing, True)

        except (
            dns.resolver.NXDOMAIN,
            dns.resolver.NoAnswer,
            dns.resolver.NoNameservers,
        ):
            listing.listed = False
            return (listing, True)
        except Exception:
            listing.listed = False
            return (listing, True)

    async def _check_domain_dnsbl(
        self,
        resolver: dns.asyncresolver.Resolver,
        domain: str,
        zone: str,
        description: str,
    ) -> tuple[DnsblListing, bool] | None:
        """Check domain against a DNSBL."""
        query = f"{domain}.{zone}"
        listing = DnsblListing(zone=zone)

        try:
            answers = await resolver.resolve(query, "A")
            if answers:
                listing.listed = True
                return_code = str(answers[0].address)
                listing.return_code = return_code

                # Get meaning based on return code
                if zone == "dbl.spamhaus.org":
                    listing.meaning = self.SPAMHAUS_DBL_CODES.get(
                        return_code, f"{description} ({return_code})"
                    )
                else:
                    listing.meaning = f"{description} ({return_code})"

                return (listing, False)
            else:
                listing.listed = False
                return (listing, False)

        except (
            dns.resolver.NXDOMAIN,
            dns.resolver.NoAnswer,
            dns.resolver.NoNameservers,
        ):
            listing.listed = False
            return (listing, False)
        except Exception:
            listing.listed = False
            return (listing, False)
