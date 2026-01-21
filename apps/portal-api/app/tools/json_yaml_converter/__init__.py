"""JSON/YAML Converter tool - frontend only, no backend router."""

from app.registry import ToolMetadata, tool_registry

TOOL_METADATA = ToolMetadata(
    id="json-yaml-converter",
    name="JSON/YAML Converter",
    description="Convert, format, and validate JSON and YAML data",
    category="Data",
    nav_order=47,
    tags=["json", "yaml", "convert", "format", "validate", "data"],
    has_backend=False,
)

# Register metadata only (no router)
tool_registry.register(TOOL_METADATA)
