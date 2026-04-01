"""FastAPI router for IP/ASN Lookup tool."""

import ipaddress
import asyncio
import socket
from typing import Optional

import httpx
import dns.resolver
import dns.reversename

from fastapi import APIRouter, HTTPException
from cachetools import TTLCache

from app.core.settings import settings
from .models import (
    IPLookupRequest,
    IPLookupResponse,
    GeoLocation,
    ASNInfo,
    IPTypeInfo,
    NetworkInfo,
    WhoisInfo,
    WhoisContact,
    ThreatIntelligence,
    AbuseReport,
)

router = APIRouter()

# Cache for WHOIS and threat intel lookups (keyed by IP)
_whois_cache: TTLCache = TTLCache(maxsize=500, ttl=settings.ip_lookup_cache_ttl_s)
_threat_cache: TTLCache = TTLCache(maxsize=500, ttl=settings.ip_lookup_cache_ttl_s)

# AbuseIPDB category mappings
ABUSEIPDB_CATEGORIES = {
    1: "DNS Compromise",
    2: "DNS Poisoning",
    3: "Fraud Orders",
    4: "DDoS Attack",
    5: "FTP Brute-Force",
    6: "Ping of Death",
    7: "Phishing",
    8: "Fraud VoIP",
    9: "Open Proxy",
    10: "Web Spam",
    11: "Email Spam",
    12: "Blog Spam",
    13: "VPN IP",
    14: "Port Scan",
    15: "Hacking",
    16: "SQL Injection",
    17: "Spoofing",
    18: "Brute-Force",
    19: "Bad Web Bot",
    20: "Exploited Host",
    21: "Web App Attack",
    22: "SSH",
    23: "IoT Targeted",
}

# IP-based blocklists to check (DNS-based)
DNSBL_LISTS = [
    ("zen.spamhaus.org", "Spamhaus ZEN"),
    ("bl.spamcop.net", "SpamCop"),
    ("b.barracudacentral.org", "Barracuda"),
    ("dnsbl.sorbs.net", "SORBS"),
    ("spam.dnsbl.sorbs.net", "SORBS Spam"),
]


def classify_ip(ip_str: str) -> IPTypeInfo:
    """Classify IP address type and properties."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return IPTypeInfo(
            version=ip.version,
            is_private=ip.is_private,
            is_loopback=ip.is_loopback,
            is_multicast=ip.is_multicast,
            is_reserved=ip.is_reserved,
            is_link_local=ip.is_link_local,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid IP address: {ip_str}")


async def get_ptr_record(ip_str: str) -> Optional[str]:
    """Get PTR (reverse DNS) record for an IP address."""
    try:
        rev_name = dns.reversename.from_address(ip_str)
        loop = asyncio.get_event_loop()
        answers = await loop.run_in_executor(
            None,
            lambda: dns.resolver.resolve(rev_name, "PTR")
        )
        if answers:
            return str(answers[0]).rstrip(".")
    except Exception:
        pass
    return None


async def get_ip_api_data(ip_str: str) -> dict:
    """Fetch IP data from ip-api.com (free tier)."""
    url = f"http://ip-api.com/json/{ip_str}"
    params = {
        "fields": "status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,proxy,hosting"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass

    return {}


async def get_whois_data(ip_str: str) -> Optional[WhoisInfo]:
    """Fetch WHOIS data for an IP address using RIPEstat and other sources."""
    # Check cache first
    if ip_str in _whois_cache:
        return _whois_cache[ip_str]

    whois_info = None

    try:
        # Use RIPEstat API for WHOIS data (works for all RIRs)
        async with httpx.AsyncClient(timeout=settings.ip_lookup_whois_timeout_s) as client:
            # Get network info
            network_url = f"https://stat.ripe.net/data/network-info/data.json?resource={ip_str}"
            network_resp = await client.get(network_url)

            prefix = None
            asn_from_whois = None

            if network_resp.status_code == 200:
                data = network_resp.json()
                if data.get("data"):
                    prefix = data["data"].get("prefix")
                    asns = data["data"].get("asns", [])
                    if asns:
                        asn_from_whois = asns[0]

            # Get WHOIS data
            whois_url = f"https://stat.ripe.net/data/whois/data.json?resource={ip_str}"
            whois_resp = await client.get(whois_url)

            network_name = None
            description = None
            country = None
            abuse_email = None
            registrant_name = None
            registrant_org = None
            created_date = None
            updated_date = None
            registry = None
            raw_lines = []

            if whois_resp.status_code == 200:
                data = whois_resp.json()
                records = data.get("data", {}).get("records", [])

                for record_group in records:
                    for record in record_group:
                        key = record.get("key", "").lower()
                        value = record.get("value", "")

                        raw_lines.append(f"{key}: {value}")

                        if key == "netname" or key == "network-name":
                            network_name = value
                        elif key == "descr" or key == "description":
                            if not description:
                                description = value
                        elif key == "country":
                            country = value
                        elif key in ("abuse-mailbox", "orgabuseemail", "abuse-c"):
                            # Prefer specific abuse emails over generic ones
                            if not abuse_email or "arin.net" not in value.lower():
                                abuse_email = value
                        elif key in ("org-name", "orgname", "organization"):
                            registrant_org = value
                        elif key == "person":
                            if not registrant_name:
                                registrant_name = value
                        elif key in ("created", "regdate"):
                            created_date = value
                        elif key in ("last-modified", "updated"):
                            updated_date = value
                        elif key == "source":
                            registry = value

            # Get abuse contact
            abuse_url = f"https://stat.ripe.net/data/abuse-contact-finder/data.json?resource={ip_str}"
            abuse_resp = await client.get(abuse_url)

            if abuse_resp.status_code == 200:
                data = abuse_resp.json()
                abuse_contacts = data.get("data", {}).get("abuse_contacts", [])
                if abuse_contacts and not abuse_email:
                    abuse_email = abuse_contacts[0]

            # Build WhoisInfo
            whois_info = WhoisInfo(
                network_name=network_name,
                network_cidr=prefix,
                description=description,
                country=country,
                registrant=WhoisContact(
                    name=registrant_name,
                    organization=registrant_org,
                ) if registrant_name or registrant_org else None,
                abuse_contact=WhoisContact(
                    email=abuse_email,
                ) if abuse_email else None,
                created_date=created_date,
                updated_date=updated_date,
                registry=registry,
                raw_whois="\n".join(raw_lines[:30]) if raw_lines else None,
            )

    except Exception:
        pass

    # Cache result
    if whois_info:
        _whois_cache[ip_str] = whois_info

    return whois_info


async def check_dnsbl(ip_str: str) -> list[str]:
    """Check IP against DNS-based blocklists."""
    hits = []

    # Reverse the IP for DNSBL queries
    try:
        ip = ipaddress.ip_address(ip_str)
        if ip.version == 4:
            reversed_ip = ".".join(reversed(ip_str.split(".")))
        else:
            # IPv6 DNSBL support is limited, skip for now
            return hits
    except ValueError:
        return hits

    async def check_single_dnsbl(dnsbl: str, name: str) -> Optional[str]:
        query = f"{reversed_ip}.{dnsbl}"
        try:
            loop = asyncio.get_event_loop()
            await asyncio.wait_for(
                loop.run_in_executor(None, lambda: socket.gethostbyname(query)),
                timeout=3.0
            )
            return name
        except Exception:
            return None

    # Check all DNSBLs in parallel
    tasks = [check_single_dnsbl(dnsbl, name) for dnsbl, name in DNSBL_LISTS]
    results = await asyncio.gather(*tasks)

    hits = [r for r in results if r is not None]
    return hits


async def get_abuseipdb_data(ip_str: str) -> Optional[dict]:
    """Fetch threat intelligence from AbuseIPDB (requires API key)."""
    if not settings.abuseipdb_api_key:
        return None

    # Check cache first
    cache_key = f"abuseipdb_{ip_str}"
    if cache_key in _threat_cache:
        return _threat_cache[cache_key]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.abuseipdb.com/api/v2/check",
                params={
                    "ipAddress": ip_str,
                    "maxAgeInDays": 90,
                    "verbose": True,
                },
                headers={
                    "Key": settings.abuseipdb_api_key,
                    "Accept": "application/json",
                },
            )

            if response.status_code == 200:
                data = response.json().get("data", {})
                _threat_cache[cache_key] = data
                return data
    except Exception:
        pass

    return None


async def get_threat_intelligence(ip_str: str) -> Optional[ThreatIntelligence]:
    """Gather threat intelligence from multiple sources."""
    # Run DNSBL checks and AbuseIPDB lookup in parallel
    dnsbl_task = check_dnsbl(ip_str)
    abuseipdb_task = get_abuseipdb_data(ip_str)

    blocklist_hits, abuseipdb_data = await asyncio.gather(dnsbl_task, abuseipdb_task)

    # Initialize threat intel
    abuse_confidence = None
    total_reports = None
    num_users = None
    last_reported = None
    abuse_categories = []
    recent_reports = []
    is_whitelisted = None

    if abuseipdb_data:
        abuse_confidence = abuseipdb_data.get("abuseConfidenceScore")
        total_reports = abuseipdb_data.get("totalReports")
        num_users = abuseipdb_data.get("numDistinctUsers")
        last_reported = abuseipdb_data.get("lastReportedAt")
        is_whitelisted = abuseipdb_data.get("isWhitelisted")

        # Parse reports
        reports = abuseipdb_data.get("reports", [])[:5]  # Last 5 reports
        for report in reports:
            categories = [
                ABUSEIPDB_CATEGORIES.get(cat, f"Category {cat}")
                for cat in report.get("categories", [])
            ]
            # Collect unique categories
            for cat in categories:
                if cat not in abuse_categories:
                    abuse_categories.append(cat)

            recent_reports.append(AbuseReport(
                reported_at=report.get("reportedAt"),
                categories=categories,
                comment=report.get("comment", "")[:200] if report.get("comment") else None,
                reporter_country=report.get("reporterCountryCode"),
            ))

    # Calculate overall threat score
    threat_score = 0

    if abuse_confidence is not None:
        threat_score = max(threat_score, abuse_confidence)

    # Add points for blocklist hits
    threat_score = min(100, threat_score + len(blocklist_hits) * 15)

    # Determine threat level
    if threat_score >= 75:
        threat_level = "critical"
    elif threat_score >= 50:
        threat_level = "high"
    elif threat_score >= 25:
        threat_level = "medium"
    else:
        threat_level = "low"

    # Only return if we have any data
    if (abuse_confidence is not None or blocklist_hits or
            total_reports is not None):
        return ThreatIntelligence(
            abuse_confidence_score=abuse_confidence,
            total_reports=total_reports,
            num_distinct_users=num_users,
            last_reported_at=last_reported,
            abuse_categories=abuse_categories,
            recent_reports=recent_reports,
            is_whitelisted=is_whitelisted,
            blocklist_hits=blocklist_hits,
            threat_score=threat_score,
            threat_level=threat_level,
        )

    return None


@router.post("/run", response_model=IPLookupResponse)
async def lookup_ip(request: IPLookupRequest) -> IPLookupResponse:
    """Look up IP address information including WHOIS and threat intelligence."""
    ip_str = request.ip.strip()

    # Validate and classify IP
    ip_type = classify_ip(ip_str)

    # For private/loopback IPs, we can only provide classification
    if ip_type.is_private or ip_type.is_loopback or ip_type.is_reserved:
        return IPLookupResponse(
            ip=ip_str,
            ip_type=ip_type,
            error="Cannot look up private, loopback, or reserved IP addresses"
        )

    # Fetch all data in parallel
    ptr_task = get_ptr_record(ip_str)
    api_task = get_ip_api_data(ip_str)
    whois_task = get_whois_data(ip_str)
    threat_task = get_threat_intelligence(ip_str)

    ptr_record, api_data, whois_info, threat_intel = await asyncio.gather(
        ptr_task, api_task, whois_task, threat_task
    )

    # Build response
    geolocation = None
    asn_info = None
    network_info = None

    if api_data and api_data.get("status") == "success":
        # Parse geolocation
        geolocation = GeoLocation(
            country=api_data.get("country"),
            country_code=api_data.get("countryCode"),
            region=api_data.get("regionName"),
            region_code=api_data.get("region"),
            city=api_data.get("city"),
            zip_code=api_data.get("zip"),
            latitude=api_data.get("lat"),
            longitude=api_data.get("lon"),
            timezone=api_data.get("timezone"),
        )

        # Parse ASN info
        as_str = api_data.get("as", "")
        asn = None
        if as_str:
            parts = as_str.split(" ", 1)
            if parts[0].upper().startswith("AS"):
                try:
                    asn = int(parts[0][2:])
                except ValueError:
                    pass

        asn_info = ASNInfo(
            asn=asn,
            as_name=api_data.get("asname"),
            as_org=api_data.get("org"),
        )

        # Parse network info
        network_info = NetworkInfo(
            ptr=ptr_record,
            isp=api_data.get("isp"),
            org=api_data.get("org"),
            is_hosting=api_data.get("hosting"),
            is_proxy=api_data.get("proxy"),
        )
    else:
        # At minimum, include PTR if we got it
        if ptr_record:
            network_info = NetworkInfo(ptr=ptr_record)

    return IPLookupResponse(
        ip=ip_str,
        ip_type=ip_type,
        geolocation=geolocation,
        asn=asn_info,
        network=network_info,
        whois=whois_info,
        threat_intelligence=threat_intel,
    )
