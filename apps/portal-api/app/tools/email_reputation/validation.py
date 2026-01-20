"""Input validation for Email Reputation Analyzer."""

import ipaddress
import re

# Domain validation regex - RFC compliant
_VALID_HOSTNAME_RE = re.compile(
    r"^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*\.?$"
)

# Email local part - simplified RFC 5321 compliance
_VALID_LOCAL_RE = re.compile(r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$")


class ValidationError(Exception):
    """Validation error for email reputation inputs."""

    pass


def validate_domain(domain: str) -> str:
    """
    Validate and normalize a domain name.

    Args:
        domain: Domain to validate

    Returns:
        Normalized domain (lowercase, no trailing dot)

    Raises:
        ValidationError: If domain is invalid
    """
    if not domain:
        raise ValidationError("Domain is required")

    # Remove protocol if present
    domain = domain.strip().lower()
    if "://" in domain:
        raise ValidationError("Domain should not include protocol (http/https)")

    # Remove path if present
    if "/" in domain:
        domain = domain.split("/")[0]

    # Remove trailing dot
    domain = domain.rstrip(".")

    # Check for IP address
    try:
        ipaddress.ip_address(domain)
        raise ValidationError("IP address provided instead of domain")
    except ValueError:
        pass

    # Validate domain format
    if not _VALID_HOSTNAME_RE.match(domain):
        raise ValidationError(f"Invalid domain format: {domain}")

    # Check for at least one dot (TLD required)
    if "." not in domain:
        raise ValidationError("Domain must include a TLD")

    return domain


def validate_ip(ip: str) -> str:
    """
    Validate an IP address.

    Args:
        ip: IP address to validate

    Returns:
        Normalized IP address string

    Raises:
        ValidationError: If IP is invalid
    """
    if not ip:
        raise ValidationError("IP address is required")

    ip = ip.strip()

    try:
        parsed = ipaddress.ip_address(ip)
        return str(parsed)
    except ValueError as e:
        raise ValidationError(f"Invalid IP address: {e}") from None


def validate_email(email: str) -> tuple[str, str]:
    """
    Validate an email address and extract parts.

    Args:
        email: Email address to validate

    Returns:
        Tuple of (local_part, domain)

    Raises:
        ValidationError: If email is invalid
    """
    if not email:
        raise ValidationError("Email address is required")

    email = email.strip().lower()

    if "@" not in email:
        raise ValidationError("Email must contain @ symbol")

    parts = email.rsplit("@", 1)
    if len(parts) != 2:
        raise ValidationError("Invalid email format")

    local_part, domain = parts

    if not local_part:
        raise ValidationError("Email local part is empty")

    if len(local_part) > 64:
        raise ValidationError("Email local part exceeds 64 characters")

    if not _VALID_LOCAL_RE.match(local_part):
        raise ValidationError("Email local part contains invalid characters")

    # Validate domain part
    domain = validate_domain(domain)

    return local_part, domain


def validate_hostname(hostname: str) -> str:
    """
    Validate a hostname (for HELO/EHLO).

    Args:
        hostname: Hostname to validate

    Returns:
        Normalized hostname

    Raises:
        ValidationError: If hostname is invalid
    """
    if not hostname:
        raise ValidationError("Hostname is required")

    hostname = hostname.strip().lower().rstrip(".")

    if not _VALID_HOSTNAME_RE.match(hostname):
        raise ValidationError(f"Invalid hostname format: {hostname}")

    return hostname
