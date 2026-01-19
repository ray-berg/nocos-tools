"""SSRF protection utilities for URL validation."""

import ipaddress
import socket
from urllib.parse import urlparse


class SSRFError(Exception):
    """Raised when a URL fails SSRF validation."""

    pass


# Private and reserved IP ranges that should be blocked
BLOCKED_NETWORKS = [
    # Loopback
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    # Private networks (RFC1918)
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    # Link-local
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("fe80::/10"),
    # Cloud metadata endpoints
    ipaddress.ip_network("169.254.169.254/32"),
    # Localhost IPv6
    ipaddress.ip_network("::ffff:127.0.0.0/104"),
    # Private IPv6
    ipaddress.ip_network("fc00::/7"),
    # Documentation/example ranges
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
    ipaddress.ip_network("2001:db8::/32"),
    # Broadcast
    ipaddress.ip_network("255.255.255.255/32"),
    # Unspecified
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("::/128"),
]

# Blocked hostnames
BLOCKED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "ip6-localhost",
    "ip6-loopback",
}

ALLOWED_SCHEMES = {"http", "https"}


def is_ip_blocked(ip_str: str) -> bool:
    """Check if an IP address is in a blocked range."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return any(ip in network for network in BLOCKED_NETWORKS)
    except ValueError:
        return True  # Invalid IP, block it


def validate_url(url: str) -> str:
    """
    Validate a URL for SSRF vulnerabilities.
    Returns the validated URL or raises SSRFError.
    """
    try:
        parsed = urlparse(url)
    except Exception as e:
        raise SSRFError(f"Invalid URL format: {e}")

    # Check scheme
    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise SSRFError(f"Scheme '{parsed.scheme}' not allowed. Use http or https.")

    # Check for empty host
    if not parsed.hostname:
        raise SSRFError("URL must have a hostname")

    hostname = parsed.hostname.lower()

    # Check blocked hostnames
    if hostname in BLOCKED_HOSTNAMES:
        raise SSRFError(f"Hostname '{hostname}' is not allowed")

    # Check if hostname is an IP address
    try:
        ip = ipaddress.ip_address(hostname)
        if is_ip_blocked(str(ip)):
            raise SSRFError(f"IP address '{hostname}' is in a blocked range")
    except ValueError:
        # Not an IP, it's a hostname - resolve it
        pass

    return url


def resolve_and_validate(hostname: str) -> list[str]:
    """
    Resolve hostname to IP addresses and validate each one.
    Returns list of validated IP addresses or raises SSRFError.
    """
    if hostname in BLOCKED_HOSTNAMES:
        raise SSRFError(f"Hostname '{hostname}' is not allowed")

    # Check if it's already an IP
    try:
        ip = ipaddress.ip_address(hostname)
        if is_ip_blocked(str(ip)):
            raise SSRFError(f"IP address '{hostname}' is in a blocked range")
        return [str(ip)]
    except ValueError:
        pass  # Not an IP, continue with DNS resolution

    # Resolve DNS
    try:
        results = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror as e:
        raise SSRFError(f"DNS resolution failed for '{hostname}': {e}")

    ips = list({result[4][0] for result in results})

    if not ips:
        raise SSRFError(f"No IP addresses found for '{hostname}'")

    # Validate all resolved IPs
    blocked_ips = []
    valid_ips = []

    for ip_str in ips:
        if is_ip_blocked(ip_str):
            blocked_ips.append(ip_str)
        else:
            valid_ips.append(ip_str)

    # If ALL resolved IPs are blocked, reject
    if not valid_ips:
        raise SSRFError(
            f"All resolved IP addresses for '{hostname}' are in blocked ranges: {blocked_ips}"
        )

    return valid_ips
