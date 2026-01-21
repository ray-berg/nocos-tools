"""HTTP Probe tool - detailed HTTP request analysis with timing."""

from app.registry import ToolMetadata, tool_registry
from .router import router

TOOL_METADATA = ToolMetadata(
    id="http-probe",
    name="HTTP Probe",
    description="Detailed HTTP request analysis with timing breakdown",
    category="Network",
    nav_order=46,
    tags=["http", "timing", "headers", "request", "response", "ttfb", "latency"],
    has_backend=True,
)

tool_registry.register(TOOL_METADATA, router)

__all__ = ["router", "TOOL_METADATA"]
