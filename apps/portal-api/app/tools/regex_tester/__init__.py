"""Regex Tester tool - frontend only, no backend router."""

from app.registry import ToolMetadata, tool_registry

TOOL_METADATA = ToolMetadata(
    id="regex-tester",
    name="Regex Tester",
    description="Test regular expressions with real-time matching and capture group display",
    category="Text",
    nav_order=30,
    tags=["regex", "pattern", "match", "text"],
    has_backend=False,
)

# Register metadata only (no router)
tool_registry.register(TOOL_METADATA)
