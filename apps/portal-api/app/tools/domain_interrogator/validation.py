"""Domain input validation for the domain interrogator."""

import ipaddress
import re
from urllib.parse import urlparse

import publicsuffix2


class DomainValidationError(Exception):
    """Raised when domain validation fails."""

    pass


# Pre-compiled patterns
_VALID_HOSTNAME_RE = re.compile(
    r"^(?!-)[A-Za-z0-9-]{1,63}(?<!-)$"
)
_IP_LIKE_RE = re.compile(
    r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$"
)


def validate_domain(domain: str) -> str:
    """
    Validate and normalize a domain name.

    Rejects:
    - IP addresses (IPv4 and IPv6)
    - URLs with schemes
    - Paths, query strings, fragments
    - Wildcards
    - Invalid characters
    - Invalid TLDs

    Returns the normalized domain (lowercase, no trailing dot).

    Raises:
        DomainValidationError: If validation fails.
    """
    if not domain:
        raise DomainValidationError("Domain cannot be empty")

    original = domain
    domain = domain.strip().lower()

    # Check again after stripping
    if not domain:
        raise DomainValidationError("Domain cannot be empty")

    # Remove trailing dot if present
    if domain.endswith("."):
        domain = domain[:-1]

    # Check for URL scheme
    if "://" in domain:
        raise DomainValidationError(
            f"Domain should not include a scheme (http/https). Got: {original}"
        )

    # Try to parse as URL in case user included path/query
    if "/" in domain or "?" in domain or "#" in domain:
        # Attempt to extract hostname
        parsed = urlparse(f"http://{domain}")
        if parsed.path or parsed.query or parsed.fragment:
            raise DomainValidationError(
                f"Domain should not include path, query, or fragment. Got: {original}"
            )
        domain = parsed.netloc or domain.split("/")[0]

    # Check for IPv6 address (before port removal since IPv6 uses colons)
    # IPv6 can look like ::1, 2001:db8::1, etc.
    if domain.count(":") > 1 or domain.startswith(":") or domain.endswith(":"):
        try:
            # Try to parse as IPv6
            ipaddress.IPv6Address(domain)
            raise DomainValidationError(
                f"IPv6 addresses are not valid domain names. Got: {original}"
            )
        except ipaddress.AddressValueError:
            pass  # Not a valid IPv6, continue

    # Remove port if present
    if ":" in domain:
        # Could be IPv6 in brackets or port
        if domain.startswith("["):
            raise DomainValidationError(
                f"IPv6 addresses are not valid domain names. Got: {original}"
            )
        parts = domain.rsplit(":", 1)
        if parts[1].isdigit():
            domain = parts[0]
        else:
            raise DomainValidationError(
                f"Invalid domain format. Got: {original}"
            )

    # Check for wildcards
    if "*" in domain:
        raise DomainValidationError(
            f"Wildcard domains are not supported. Got: {original}"
        )

    # Check for IPv4 address
    if _IP_LIKE_RE.match(domain):
        try:
            ipaddress.IPv4Address(domain)
            raise DomainValidationError(
                f"IP addresses are not valid domain names. Got: {original}"
            )
        except ipaddress.AddressValueError:
            pass  # Not a valid IP, might be a weird domain

    # Validate length
    if len(domain) > 253:
        raise DomainValidationError(
            f"Domain name too long (max 253 characters). Got {len(domain)}"
        )

    # Validate each label
    labels = domain.split(".")
    if len(labels) < 2:
        raise DomainValidationError(
            f"Domain must have at least two labels (e.g., example.com). Got: {original}"
        )

    for label in labels:
        if not label:
            raise DomainValidationError(
                f"Domain contains empty label. Got: {original}"
            )
        if len(label) > 63:
            raise DomainValidationError(
                f"Domain label too long (max 63 characters). Got label: {label}"
            )
        # Allow punycode (xn--) labels
        if label.startswith("xn--"):
            continue
        if not _VALID_HOSTNAME_RE.match(label):
            raise DomainValidationError(
                f"Invalid characters in domain label: {label}"
            )

    # Validate TLD using publicsuffix2
    try:
        psl = publicsuffix2.get_sld(domain)
        if psl is None:
            raise DomainValidationError(
                f"Invalid or unknown TLD in domain: {original}"
            )
    except Exception:
        # If publicsuffix2 fails, do basic TLD check
        tld = labels[-1]
        if not tld.isalpha() and not tld.startswith("xn--"):
            raise DomainValidationError(
                f"Invalid TLD: {tld}"
            ) from None

    return domain


def is_valid_domain(domain: str) -> bool:
    """Check if a domain is valid without raising an exception."""
    try:
        validate_domain(domain)
        return True
    except DomainValidationError:
        return False
