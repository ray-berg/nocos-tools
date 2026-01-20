"""Subnet Calculator tool - frontend only, no backend router."""

from app.registry import ToolMetadata, tool_registry

TOOL_METADATA = ToolMetadata(
    id="subnet-calculator",
    name="Subnet Calculator",
    description="Calculate IP subnet information and plan network allocations",
    category="Network",
    nav_order=44,
    tags=["subnet", "ip", "cidr", "network", "netmask", "ipv4"],
    has_backend=False,
)

# Register metadata only (no router)
tool_registry.register(TOOL_METADATA)
