"""FastAPI router for Traceroute tool."""

import asyncio
import ipaddress
import re
import socket
from math import radians, sin, cos, sqrt, atan2
from typing import Optional, List, Tuple

import httpx

from fastapi import APIRouter, HTTPException

from .models import (
    TracerouteRequest,
    TracerouteResponse,
    HopInfo,
    GeoLocation,
    RouteExplanation,
)

router = APIRouter()

# Private IP ranges - don't geolocate these
PRIVATE_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("fc00::/7"),
]


def is_private_ip(ip_str: str) -> bool:
    """Check if an IP address is private."""
    try:
        ip = ipaddress.ip_address(ip_str)
        for network in PRIVATE_RANGES:
            if ip in network:
                return True
        return False
    except ValueError:
        return False


def validate_target(target: str) -> str:
    """Validate and resolve target, returning IP address."""
    target = target.strip()

    # Check if it's already an IP
    try:
        ip = ipaddress.ip_address(target)
        if is_private_ip(target):
            raise HTTPException(
                status_code=400,
                detail="Cannot trace to private IP addresses"
            )
        return str(ip)
    except ValueError:
        pass

    # It's a hostname, validate and resolve
    if not re.match(r'^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$', target):
        raise HTTPException(
            status_code=400,
            detail="Invalid hostname format"
        )

    try:
        ip = socket.gethostbyname(target)
        if is_private_ip(ip):
            raise HTTPException(
                status_code=400,
                detail="Hostname resolves to private IP address"
            )
        return ip
    except socket.gaierror:
        raise HTTPException(
            status_code=400,
            detail=f"Could not resolve hostname: {target}"
        )


async def run_traceroute(target: str, max_hops: int) -> Tuple[List[dict], bool]:
    """Run traceroute command and parse output."""
    try:
        # Run traceroute with numeric output, max hops, and 2 second timeout
        proc = await asyncio.create_subprocess_exec(
            "/usr/sbin/traceroute",
            "-n",  # Numeric only (no DNS lookups during trace)
            "-m", str(max_hops),
            "-w", "2",  # 2 second timeout per hop
            "-q", "3",  # 3 queries per hop
            target,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await asyncio.wait_for(
            proc.communicate(),
            timeout=max_hops * 7  # Allow up to 7 seconds per hop
        )

        output = stdout.decode("utf-8", errors="replace")
        lines = output.strip().split("\n")

        hops = []
        completed = False

        # Parse each line (skip the header)
        for line in lines[1:]:
            line = line.strip()
            if not line:
                continue

            # Parse hop number
            match = re.match(r'^\s*(\d+)\s+(.*)$', line)
            if not match:
                continue

            hop_num = int(match.group(1))
            rest = match.group(2)

            # Check for timeout (all asterisks)
            if re.match(r'^[\s\*]+$', rest):
                hops.append({
                    "hop_number": hop_num,
                    "is_timeout": True,
                })
                continue

            # Parse IP and RTT values
            # Format: IP  RTT1 ms  RTT2 ms  RTT3 ms
            # or: IP  RTT1 ms  *  RTT3 ms (mixed timeouts)
            ip_match = re.match(r'^(\d+\.\d+\.\d+\.\d+|[0-9a-fA-F:]+)\s+(.*)$', rest)
            if ip_match:
                ip = ip_match.group(1)
                rtt_part = ip_match.group(2)

                # Extract RTT values
                rtt_values = []
                for rtt_match in re.finditer(r'([\d.]+)\s*ms', rtt_part):
                    try:
                        rtt_values.append(float(rtt_match.group(1)))
                    except ValueError:
                        pass

                hops.append({
                    "hop_number": hop_num,
                    "ip": ip,
                    "rtt_ms": rtt_values if rtt_values else None,
                    "is_timeout": False,
                })

                # Check if we reached the target
                if ip == target:
                    completed = True
            else:
                # Couldn't parse, mark as timeout
                hops.append({
                    "hop_number": hop_num,
                    "is_timeout": True,
                })

        return hops, completed

    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="Traceroute timed out"
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Traceroute command not available on server"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Traceroute failed: {str(e)}"
        )


async def geolocate_ip(ip: str) -> Optional[dict]:
    """Get geolocation data for an IP address."""
    if is_private_ip(ip):
        return None

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"http://ip-api.com/json/{ip}",
                params={
                    "fields": "status,country,countryCode,region,regionName,city,lat,lon,isp,org,as,asname"
                }
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    return data
    except Exception:
        pass
    return None


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in kilometers."""
    R = 6371  # Earth's radius in km

    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))

    return R * c


def generate_explanation(hops: List[HopInfo], target: str) -> RouteExplanation:
    """Generate a human-readable explanation of the route."""
    segments = []
    countries = []
    total_distance = 0.0
    prev_geo = None
    responsive_hops = sum(1 for h in hops if not h.is_timeout and h.ip)

    # Track country transitions
    prev_country = None
    for hop in hops:
        if hop.geolocation and hop.geolocation.country:
            if hop.geolocation.country != prev_country:
                if hop.geolocation.country not in countries:
                    countries.append(hop.geolocation.country)
                prev_country = hop.geolocation.country

    # Generate segment descriptions
    for i, hop in enumerate(hops):
        if hop.is_timeout:
            continue

        if hop.geolocation:
            geo = hop.geolocation
            location_parts = []
            if geo.city:
                location_parts.append(geo.city)
            if geo.region:
                location_parts.append(geo.region)
            if geo.country:
                location_parts.append(geo.country)
            location = ", ".join(location_parts) if location_parts else "Unknown"

            if hop.as_name:
                segments.append(f"Hop {hop.hop_number}: {location} via {hop.as_name}")
            else:
                segments.append(f"Hop {hop.hop_number}: {location}")

            # Calculate distance from previous geolocated hop
            if prev_geo:
                dist = haversine_distance(
                    prev_geo.latitude, prev_geo.longitude,
                    geo.latitude, geo.longitude
                )
                total_distance += dist
            prev_geo = geo
        elif hop.is_private:
            segments.append(f"Hop {hop.hop_number}: Private network ({hop.ip})")
        elif hop.ip:
            segments.append(f"Hop {hop.hop_number}: {hop.ip}")

    # Generate summary
    if len(countries) == 0:
        country_text = "within local/private networks"
    elif len(countries) == 1:
        country_text = f"within {countries[0]}"
    else:
        country_text = f"through {', '.join(countries[:-1])} and {countries[-1]}"

    summary = f"Route to {target} traverses {len(hops)} hops {country_text}. "
    summary += f"{responsive_hops} of {len(hops)} hops responded."

    if total_distance > 0:
        summary += f" Estimated path distance: {total_distance:.0f} km."

    return RouteExplanation(
        summary=summary,
        segments=segments[:15],  # Limit to 15 segments for readability
        total_hops=len(hops),
        responsive_hops=responsive_hops,
        countries_traversed=countries,
        estimated_distance_km=round(total_distance, 1) if total_distance > 0 else None,
    )


async def reverse_dns(ip: str) -> Optional[str]:
    """Get reverse DNS hostname for an IP."""
    try:
        loop = asyncio.get_event_loop()
        hostname, _, _ = await loop.run_in_executor(
            None,
            socket.gethostbyaddr,
            ip
        )
        return hostname
    except Exception:
        return None


@router.post("/run", response_model=TracerouteResponse)
async def run_trace(request: TracerouteRequest) -> TracerouteResponse:
    """Run a traceroute to the specified target."""
    # Validate target
    resolved_ip = validate_target(request.target)

    # Run traceroute
    raw_hops, completed = await run_traceroute(resolved_ip, request.max_hops)

    # Process hops: geolocate and enrich
    hops: List[HopInfo] = []

    # Batch geolocate all IPs
    ips_to_geolocate = [
        h["ip"] for h in raw_hops
        if h.get("ip") and not is_private_ip(h["ip"])
    ]

    # Geolocate in parallel (with rate limiting consideration)
    geo_results = {}
    if ips_to_geolocate:
        # Process in batches of 5 to respect rate limits
        for i in range(0, len(ips_to_geolocate), 5):
            batch = ips_to_geolocate[i:i+5]
            tasks = [geolocate_ip(ip) for ip in batch]
            results = await asyncio.gather(*tasks)
            for ip, result in zip(batch, results):
                geo_results[ip] = result
            if i + 5 < len(ips_to_geolocate):
                await asyncio.sleep(0.2)  # Brief pause between batches

    # Build hop info objects
    for raw_hop in raw_hops:
        hop_num = raw_hop["hop_number"]
        ip = raw_hop.get("ip")
        is_timeout = raw_hop.get("is_timeout", False)
        rtt_ms = raw_hop.get("rtt_ms")

        hop_info = HopInfo(
            hop_number=hop_num,
            ip=ip,
            is_timeout=is_timeout,
            is_private=is_private_ip(ip) if ip else False,
            rtt_ms=rtt_ms,
            avg_rtt_ms=round(sum(rtt_ms) / len(rtt_ms), 2) if rtt_ms else None,
        )

        if ip and ip in geo_results and geo_results[ip]:
            geo_data = geo_results[ip]
            hop_info.geolocation = GeoLocation(
                latitude=geo_data.get("lat", 0),
                longitude=geo_data.get("lon", 0),
                city=geo_data.get("city"),
                region=geo_data.get("regionName"),
                country=geo_data.get("country"),
                country_code=geo_data.get("countryCode"),
            )
            hop_info.isp = geo_data.get("isp")

            # Parse ASN
            as_str = geo_data.get("as", "")
            if as_str and as_str.startswith("AS"):
                parts = as_str.split(" ", 1)
                try:
                    hop_info.asn = int(parts[0][2:])
                except ValueError:
                    pass
            hop_info.as_name = geo_data.get("asname")

        hops.append(hop_info)

    # Get reverse DNS for destination
    hostname = None
    if request.target != resolved_ip:
        hostname = request.target

    # Generate explanation
    explanation = generate_explanation(hops, request.target)

    return TracerouteResponse(
        target=request.target,
        resolved_ip=resolved_ip if resolved_ip != request.target else None,
        hops=hops,
        explanation=explanation,
        completed=completed,
    )
