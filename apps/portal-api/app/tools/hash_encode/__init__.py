"""Hash & Encode tool - frontend only, no backend router."""

from app.registry import ToolMetadata, tool_registry

TOOL_METADATA = ToolMetadata(
    id="hash-encode",
    name="Hash & Encode",
    description="Calculate hashes and encode/decode text in various formats",
    category="Encoding",
    nav_order=40,
    tags=["hash", "md5", "sha", "base64", "url", "hex", "encode", "decode"],
    has_backend=False,
)

# Register metadata only (no router)
tool_registry.register(TOOL_METADATA)
