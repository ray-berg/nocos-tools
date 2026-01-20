"""Cron Expression Explainer tool - frontend only, no backend router."""

from app.registry import ToolMetadata, tool_registry

TOOL_METADATA = ToolMetadata(
    id="cron-explainer",
    name="Cron Expression Explainer",
    description="Parse cron expressions and see next execution times",
    category="Developer",
    nav_order=42,
    tags=["cron", "schedule", "time", "job", "automation"],
    has_backend=False,
)

# Register metadata only (no router)
tool_registry.register(TOOL_METADATA)
