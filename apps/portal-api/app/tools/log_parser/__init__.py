"""Log Parser tool - frontend only, no backend router."""

from app.registry import ToolMetadata, tool_registry

TOOL_METADATA = ToolMetadata(
    id="log-parser",
    name="Log Parser",
    description="Parse and analyze common log formats",
    category="Data",
    nav_order=51,
    tags=["log", "parse", "apache", "nginx", "syslog", "json", "analyze"],
    has_backend=False,
)

# Register metadata only (no router)
tool_registry.register(TOOL_METADATA)
