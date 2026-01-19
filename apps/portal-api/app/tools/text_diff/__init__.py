"""Text Diff & Cleanup tool - frontend only, no backend router."""

from app.registry import ToolMetadata, tool_registry

TOOL_METADATA = ToolMetadata(
    id="text-diff",
    name="Text Diff & Cleanup",
    description="Compare two text blocks and apply common cleanup operations",
    category="Text",
    nav_order=10,
    tags=["diff", "text", "cleanup", "compare"],
    has_backend=False,
)

# Register metadata only (no router)
tool_registry.register(TOOL_METADATA)
