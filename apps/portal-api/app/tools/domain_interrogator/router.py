"""FastAPI router for domain interrogator endpoints."""

from fastapi import APIRouter, HTTPException

from app.core.settings import settings
from app.registry import tool_registry
from app.tools.domain_interrogator.cache import domain_cache
from app.tools.domain_interrogator.metadata import TOOL_METADATA
from app.tools.domain_interrogator.models import (
    DomainReport,
    PresetsResponse,
    RunRequest,
)
from app.tools.domain_interrogator.orchestrator import DomainOrchestrator
from app.tools.domain_interrogator.validation import (
    DomainValidationError,
    validate_domain,
)

router = APIRouter()


@router.post("/run", response_model=DomainReport)
async def run_interrogation(request: RunRequest) -> DomainReport:
    """
    Run a comprehensive domain interrogation.

    Collects DNS, DNSSEC, email configuration, web/TLS,
    RDAP registration, IP intelligence, and subdomain information.
    """
    # Validate domain
    try:
        validated_domain = validate_domain(request.domain)
    except DomainValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    # Update request with validated domain
    request.domain = validated_domain

    # Run orchestrator
    orchestrator = DomainOrchestrator(request)
    report = await orchestrator.run()

    return report


@router.get("/presets", response_model=PresetsResponse)
async def get_presets() -> PresetsResponse:
    """Get default options and cache TTL."""
    return PresetsResponse(
        default_include_web=settings.domain_intel_web_fetch,
        default_include_ct=True,
        default_include_dnssec=settings.domain_intel_dnssec_check,
        cache_ttl_seconds=domain_cache.ttl,
    )


# Register tool with router
tool_registry.register(TOOL_METADATA, router)
