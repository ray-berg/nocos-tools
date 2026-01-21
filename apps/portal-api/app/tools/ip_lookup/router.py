"""FastAPI router for IP/ASN Lookup tool."""

import ipaddress
import asyncio
from typing import Optional

import httpx
import dns.resolver
import dns.reversename

from fastapi import APIRouter, HTTPException

from .models import (
    IPLookupRequest,
    IPLookupResponse,
    GeoLocation,
    ASNInfo,
    IPTypeInfo,
    NetworkInfo,
)

router = APIRouter(prefix="/ip-lookup", tags=["ip-lookup"])


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
    # ip-api.com provides free geolocation and ASN data
    # Rate limit: 45 requests per minute
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


@router.post("/run", response_model=IPLookupResponse)
async def lookup_ip(request: IPLookupRequest) -> IPLookupResponse:
    """Look up IP address information."""
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

    # Fetch data in parallel
    ptr_task = get_ptr_record(ip_str)
    api_task = get_ip_api_data(ip_str)

    ptr_record, api_data = await asyncio.gather(ptr_task, api_task)

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
            # Format is usually "AS12345 Organization Name"
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
    )
