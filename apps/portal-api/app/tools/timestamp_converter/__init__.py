"""Unix Timestamp Converter tool - frontend only, no backend router."""

from app.registry import ToolMetadata, tool_registry

TOOL_METADATA = ToolMetadata(
    id="timestamp-converter",
    name="Unix Timestamp Converter",
    description="Convert between Unix timestamps and human-readable dates",
    category="Developer",
    nav_order=43,
    tags=["timestamp", "unix", "epoch", "date", "time", "convert"],
    has_backend=False,
)

# Register metadata only (no router)
tool_registry.register(TOOL_METADATA)
