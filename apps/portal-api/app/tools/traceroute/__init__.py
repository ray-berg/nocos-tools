"""Traceroute tool - trace network path with geolocation visualization."""

from app.registry import ToolMetadata, tool_registry
from .router import router

TOOL_METADATA = ToolMetadata(
    id="traceroute",
    name="Traceroute",
    description="Trace network path to a destination with geolocation map visualization",
    category="Network",
    nav_order=47,
    tags=["traceroute", "network", "path", "hops", "latency", "geolocation", "map"],
    has_backend=True,
)

tool_registry.register(TOOL_METADATA, router)

__all__ = ["router", "TOOL_METADATA"]
