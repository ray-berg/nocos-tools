"""Tool metadata for domain interrogator."""

from app.registry import ToolMetadata

TOOL_METADATA = ToolMetadata(
    id="domain-interrogator",
    name="Domain Interrogator",
    description=(
        "Comprehensive domain intelligence: DNS, DNSSEC, email config, "
        "TLS, RDAP, and subdomain discovery"
    ),
    category="Network",
    nav_order=25,
    tags=[
        "domain",
        "dns",
        "dnssec",
        "email",
        "spf",
        "dmarc",
        "tls",
        "ssl",
        "certificate",
        "rdap",
        "whois",
        "subdomain",
        "security",
    ],
    has_backend=True,
)
