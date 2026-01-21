"""FastAPI router for HTTP Probe tool."""

import ipaddress
import socket
import time
from typing import Optional, Dict, List
from urllib.parse import urlparse

import httpx

from fastapi import APIRouter, HTTPException

from .models import (
    HttpProbeRequest,
    HttpProbeResponse,
    TimingInfo,
    RedirectHop,
    ResponseInfo,
)

router = APIRouter(prefix="/http-probe", tags=["http-probe"])

# Maximum response body to preview
MAX_BODY_PREVIEW = 4096

# SSRF Protection: Block private/internal IP ranges
BLOCKED_IP_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # Link-local
    ipaddress.ip_network("::1/128"),  # IPv6 loopback
    ipaddress.ip_network("fe80::/10"),  # IPv6 link-local
    ipaddress.ip_network("fc00::/7"),  # IPv6 unique local
    ipaddress.ip_network("100.64.0.0/10"),  # Carrier-grade NAT
    ipaddress.ip_network("0.0.0.0/8"),  # "This" network
]


def is_ip_blocked(ip_str: str) -> bool:
    """Check if an IP address is in a blocked range."""
    try:
        ip = ipaddress.ip_address(ip_str)
        for network in BLOCKED_IP_RANGES:
            if ip in network:
                return True
    except ValueError:
        pass
    return False


def validate_url(url: str) -> str:
    """Validate and normalize URL, checking for SSRF."""
    parsed = urlparse(url)

    # Must be http or https
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=400,
            detail="Only HTTP and HTTPS URLs are allowed"
        )

    # Must have a hostname
    if not parsed.hostname:
        raise HTTPException(
            status_code=400,
            detail="Invalid URL: no hostname"
        )

    hostname = parsed.hostname

    # Check if hostname is an IP address directly
    try:
        if is_ip_blocked(hostname):
            raise HTTPException(
                status_code=400,
                detail="Access to private/internal IP addresses is not allowed"
            )
    except ValueError:
        pass  # Not an IP, will resolve below

    # Resolve hostname and check all IPs
    try:
        # Get all IP addresses for the hostname
        addr_info = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
        for family, _, _, _, sockaddr in addr_info:
            ip = sockaddr[0]
            if is_ip_blocked(ip):
                raise HTTPException(
                    status_code=400,
                    detail=f"Hostname resolves to blocked IP address"
                )
    except socket.gaierror as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not resolve hostname: {e}"
        )

    return url


def get_http_version_string(http_version: httpx.HTTPStatusError | str | int | None) -> str:
    """Convert HTTP version to string."""
    if http_version == 10:
        return "HTTP/1.0"
    elif http_version == 11:
        return "HTTP/1.1"
    elif http_version == 20:
        return "HTTP/2"
    else:
        return f"HTTP/{http_version}" if http_version else "Unknown"


@router.post("/run", response_model=HttpProbeResponse)
async def probe_url(request: HttpProbeRequest) -> HttpProbeResponse:
    """Probe a URL with detailed timing and response information."""
    # Validate URL for SSRF
    url = validate_url(request.url.strip())

    # Prepare custom headers
    headers = request.headers or {}
    if "User-Agent" not in headers:
        headers["User-Agent"] = "Mozilla/5.0 (compatible; HTTPProbe/1.0)"

    # Track redirects manually for detailed info
    redirects: List[RedirectHop] = []
    current_url = url
    final_response = None

    # Timing
    start_time = time.perf_counter()
    dns_time: Optional[float] = None
    connect_time: Optional[float] = None
    tls_time: Optional[float] = None
    ttfb_time: Optional[float] = None

    try:
        # Create client that doesn't follow redirects automatically
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            follow_redirects=False,
            verify=True,
        ) as client:
            redirect_count = 0
            max_redirects = request.max_redirects if request.follow_redirects else 0

            while True:
                # Validate each redirect URL for SSRF
                if redirect_count > 0:
                    current_url = validate_url(current_url)

                request_start = time.perf_counter()

                # Make the request
                response = await client.request(
                    method=request.method if redirect_count == 0 else "GET",
                    url=current_url,
                    headers=headers,
                )

                request_end = time.perf_counter()

                # Record TTFB for first request
                if redirect_count == 0:
                    ttfb_time = (request_end - request_start) * 1000

                # Check for redirect
                if response.is_redirect and redirect_count < max_redirects:
                    location = response.headers.get("location")
                    redirects.append(RedirectHop(
                        url=current_url,
                        status_code=response.status_code,
                        location=location,
                    ))

                    if not location:
                        final_response = response
                        break

                    # Handle relative URLs
                    if not location.startswith(("http://", "https://")):
                        from urllib.parse import urljoin
                        location = urljoin(current_url, location)

                    current_url = location
                    redirect_count += 1
                else:
                    final_response = response
                    break

        end_time = time.perf_counter()
        total_time = (end_time - start_time) * 1000

        if not final_response:
            raise HTTPException(status_code=500, detail="No response received")

        # Read response body
        body = final_response.content
        body_size = len(body)

        # Create body preview
        body_preview = None
        content_type = final_response.headers.get("content-type", "")

        if "text" in content_type or "json" in content_type or "xml" in content_type:
            try:
                decoded = body[:MAX_BODY_PREVIEW].decode("utf-8", errors="replace")
                body_preview = decoded
                if body_size > MAX_BODY_PREVIEW:
                    body_preview += f"\n... (truncated, {body_size} bytes total)"
            except Exception:
                body_preview = f"[Binary content, {body_size} bytes]"
        else:
            body_preview = f"[Binary content: {content_type}, {body_size} bytes]"

        # Build response headers dict
        response_headers = dict(final_response.headers)

        # Determine HTTP version
        http_version = get_http_version_string(final_response.http_version)

        # Build timing info
        timing = TimingInfo(
            dns_lookup_ms=dns_time,
            tcp_connect_ms=connect_time,
            tls_handshake_ms=tls_time,
            time_to_first_byte_ms=ttfb_time,
            content_download_ms=None,  # Would need more granular timing
            total_ms=round(total_time, 2),
        )

        # Build response info
        response_info = ResponseInfo(
            status_code=final_response.status_code,
            status_text=final_response.reason_phrase or "",
            http_version=http_version,
            headers=response_headers,
            content_type=content_type or None,
            content_length=int(final_response.headers.get("content-length", 0)) or None,
            content_encoding=final_response.headers.get("content-encoding"),
            body_preview=body_preview,
            body_size=body_size,
        )

        return HttpProbeResponse(
            request_url=request.url,
            final_url=str(final_response.url),
            method=request.method,
            timing=timing,
            response=response_info,
            redirects=redirects,
            tls_used=str(final_response.url).startswith("https://"),
        )

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Request failed: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
