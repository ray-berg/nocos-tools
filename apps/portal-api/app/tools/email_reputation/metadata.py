"""Tool metadata for Email Risk & Reputation Analyzer."""

from app.registry import ToolMetadata

TOOL_METADATA = ToolMetadata(
    id="email-reputation",
    name="Email Reputation Analyzer",
    description="Assess email deliverability risk based on authentication and policy signals",
    category="Network",
    nav_order=26,
    tags=[
        "email",
        "deliverability",
        "spf",
        "dkim",
        "dmarc",
        "reputation",
        "dnsbl",
        "blacklist",
        "smtp",
    ],
    has_backend=True,
)
