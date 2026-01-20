"""JWT Inspector tool - frontend only, no backend router."""

from app.registry import ToolMetadata, tool_registry

TOOL_METADATA = ToolMetadata(
    id="jwt-inspector",
    name="JWT Inspector",
    description="Decode and analyze JSON Web Tokens",
    category="Security",
    nav_order=41,
    tags=["jwt", "token", "auth", "decode", "json", "security"],
    has_backend=False,
)

# Register metadata only (no router)
tool_registry.register(TOOL_METADATA)
