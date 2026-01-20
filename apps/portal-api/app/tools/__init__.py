# Import all tools to trigger registration
from app.tools import regex_tester  # noqa: F401
from app.tools import text_diff  # noqa: F401
from app.tools.domain_interrogator import router as domain_interrogator_router  # noqa: F401
from app.tools.url_inspector import router as url_inspector_router  # noqa: F401
from app.tools.email_reputation import router as email_reputation_router  # noqa: F401

__all__ = ["url_inspector_router", "domain_interrogator_router", "email_reputation_router"]
