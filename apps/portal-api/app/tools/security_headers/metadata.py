"""Tool metadata for Security Headers Analyzer."""

from app.registry import ToolMetadata

TOOL_METADATA = ToolMetadata(
    id="security-headers",
    name="Security Headers Analyzer",
    description="Evaluate HTTP security headers with scoring and recommendations",
    category="Network",
    nav_order=46,
    tags=[
        "security",
        "headers",
        "csp",
        "hsts",
        "http",
        "https",
        "xss",
        "clickjacking",
    ],
    has_backend=True,
)
