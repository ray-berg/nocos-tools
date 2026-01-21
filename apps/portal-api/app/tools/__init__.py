# Import all tools to trigger registration
# Frontend-only tools (metadata only)
from app.tools import regex_tester  # noqa: F401
from app.tools import text_diff  # noqa: F401
from app.tools import hash_encode  # noqa: F401
from app.tools import jwt_inspector  # noqa: F401
from app.tools import cron_explainer  # noqa: F401
from app.tools import timestamp_converter  # noqa: F401
from app.tools import subnet_calculator  # noqa: F401
from app.tools import json_yaml_converter  # noqa: F401
from app.tools import csv_inspector  # noqa: F401
from app.tools import log_parser  # noqa: F401

# Backend tools (with routers)
from app.tools.domain_interrogator import router as domain_interrogator_router  # noqa: F401
from app.tools.url_inspector import router as url_inspector_router  # noqa: F401
from app.tools.email_reputation import router as email_reputation_router  # noqa: F401
from app.tools.ssl_inspector import router as ssl_inspector_router  # noqa: F401
from app.tools.security_headers import router as security_headers_router  # noqa: F401
from app.tools.ip_lookup import router as ip_lookup_router  # noqa: F401
from app.tools.http_probe import router as http_probe_router  # noqa: F401

__all__ = [
    "url_inspector_router",
    "domain_interrogator_router",
    "email_reputation_router",
    "ssl_inspector_router",
    "security_headers_router",
    "ip_lookup_router",
    "http_probe_router",
]
