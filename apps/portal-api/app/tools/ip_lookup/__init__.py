"""IP/ASN Lookup tool - IP address intelligence and geolocation."""

from app.registry import ToolMetadata, tool_registry
from .router import router

TOOL_METADATA = ToolMetadata(
    id="ip-lookup",
    name="IP/ASN Lookup",
    description="IP address intelligence, geolocation, ASN, WHOIS, and threat intelligence",
    category="Network",
    nav_order=45,
    tags=["ip", "asn", "geolocation", "whois", "ptr", "reverse-dns", "threat", "abuse", "blocklist"],
    has_backend=True,
)

tool_registry.register(TOOL_METADATA, router)

__all__ = ["router", "TOOL_METADATA"]
