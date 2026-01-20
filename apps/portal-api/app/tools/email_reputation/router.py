"""FastAPI router for Email Reputation Analyzer."""

from fastapi import APIRouter, HTTPException

from app.core.settings import settings
from app.registry import tool_registry
from app.tools.email_reputation.metadata import TOOL_METADATA
from app.tools.email_reputation.models import (
    EmailReputationReport,
    PresetsResponse,
    RunRequest,
)
from app.tools.email_reputation.orchestrator import EmailReputationOrchestrator
from app.tools.email_reputation.validation import (
    ValidationError,
    validate_domain,
    validate_email,
    validate_ip,
)

router = APIRouter()


@router.post("/run", response_model=EmailReputationReport)
async def run_analysis(request: RunRequest) -> EmailReputationReport:
    """
    Run email reputation analysis.

    Analyzes a domain (and optionally sending IP) for email deliverability risk.
    """
    # Validate domain
    try:
        domain = validate_domain(request.domain)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None

    # Validate sending IP if provided
    sending_ip = None
    if request.sending_ip:
        try:
            sending_ip = validate_ip(request.sending_ip)
        except ValidationError as e:
            raise HTTPException(status_code=400, detail=str(e)) from None

    # Validate from address if provided
    if request.from_address:
        try:
            validate_email(request.from_address)
        except ValidationError as e:
            raise HTTPException(status_code=400, detail=str(e)) from None

    # Create validated request
    validated_request = RunRequest(
        domain=domain,
        sending_ip=sending_ip,
        from_address=request.from_address,
        helo_hostname=request.helo_hostname,
        assume_provider=request.assume_provider,
    )

    # Run orchestrator
    orchestrator = EmailReputationOrchestrator(validated_request)
    report = await orchestrator.run()

    return report


@router.get("/presets", response_model=PresetsResponse)
async def get_presets() -> PresetsResponse:
    """Get default presets and configuration."""
    return PresetsResponse(
        cache_ttl_seconds=settings.email_rep_cache_ttl_s,
    )


# Register tool
tool_registry.register(TOOL_METADATA, router)
