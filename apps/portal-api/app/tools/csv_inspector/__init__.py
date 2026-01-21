"""CSV Inspector tool - frontend only, no backend router."""

from app.registry import ToolMetadata, tool_registry

TOOL_METADATA = ToolMetadata(
    id="csv-inspector",
    name="CSV Inspector",
    description="Parse, analyze, and convert CSV data",
    category="Data",
    nav_order=50,
    tags=["csv", "data", "table", "convert", "json", "parse"],
    has_backend=False,
)

# Register metadata only (no router)
tool_registry.register(TOOL_METADATA)
