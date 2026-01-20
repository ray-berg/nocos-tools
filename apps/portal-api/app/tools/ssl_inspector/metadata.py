"""Tool metadata for SSL Certificate Inspector."""

from app.registry import ToolMetadata

TOOL_METADATA = ToolMetadata(
    id="ssl-inspector",
    name="SSL Certificate Inspector",
    description="Analyze TLS/SSL certificates including chain, expiry, and security details",
    category="Network",
    nav_order=45,
    tags=[
        "ssl",
        "tls",
        "certificate",
        "https",
        "security",
        "expiry",
        "chain",
    ],
    has_backend=True,
)
