"""Email Risk & Reputation Analyzer tool."""

from app.tools.email_reputation.metadata import TOOL_METADATA
from app.tools.email_reputation.router import router

__all__ = ["router", "TOOL_METADATA"]
