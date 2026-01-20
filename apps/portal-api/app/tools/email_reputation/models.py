"""Pydantic models for Email Reputation Analyzer."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class AssumedProvider(str, Enum):
    """Known email provider for heuristics."""

    MICROSOFT365 = "microsoft365"
    GOOGLE = "google"


class RunRequest(BaseModel):
    """Request model for email reputation analysis."""

    domain: str = Field(..., min_length=1, max_length=253)
    sending_ip: str | None = Field(None, description="Sending IP for PTR/DNSBL checks")
    from_address: str | None = Field(None, description="Full from address for analysis")
    helo_hostname: str | None = Field(None, description="HELO/EHLO hostname")
    assume_provider: AssumedProvider | None = Field(
        None, description="Assume recipient uses this provider"
    )


class PresetsResponse(BaseModel):
    """Response for presets endpoint."""

    cache_ttl_seconds: int


# SPF models
class SpfStatus(str, Enum):
    """SPF record status."""

    PASSABLE = "passable"
    FRAGILE = "fragile"
    BROKEN = "broken"


class SpfInfo(BaseModel):
    """SPF analysis results."""

    record: str | None = None
    exists: bool = False
    status: SpfStatus = SpfStatus.BROKEN
    mechanisms: list[str] = Field(default_factory=list)
    lookup_count: int = 0
    all_mechanism: str | None = None
    has_redirect: bool = False
    has_multiple_records: bool = False
    issues: list[str] = Field(default_factory=list)


# DKIM models
class DkimStatus(str, Enum):
    """DKIM discovery status."""

    PRESENT = "present"
    LIKELY_PRESENT = "likely_present"
    UNKNOWN = "unknown"


class DkimSelector(BaseModel):
    """Information about a discovered DKIM selector."""

    selector: str
    key_type: str | None = None
    key_bits: int | None = None
    weak_key: bool = False


class DkimInfo(BaseModel):
    """DKIM analysis results."""

    status: DkimStatus = DkimStatus.UNKNOWN
    selectors_found: list[DkimSelector] = Field(default_factory=list)
    selectors_checked: list[str] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)


# DMARC models
class DmarcStatus(str, Enum):
    """DMARC enforcement status."""

    STRICT = "strict"
    ENFORCING = "enforcing"
    MONITORING = "monitoring"
    ABSENT = "absent"


class DmarcInfo(BaseModel):
    """DMARC analysis results."""

    record: str | None = None
    exists: bool = False
    status: DmarcStatus = DmarcStatus.ABSENT
    policy: str | None = None
    subdomain_policy: str | None = None
    alignment_dkim: str | None = None
    alignment_spf: str | None = None
    pct: int = 100
    rua: list[str] = Field(default_factory=list)
    ruf: list[str] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)


# PTR models
class PtrStatus(str, Enum):
    """PTR record status."""

    ALIGNED = "aligned"
    EXISTS_MISMATCHED = "exists_mismatched"
    MISSING = "missing"


class PtrInfo(BaseModel):
    """PTR analysis results."""

    status: PtrStatus = PtrStatus.MISSING
    ptr_hostname: str | None = None
    forward_ips: list[str] = Field(default_factory=list)
    fcrdns_valid: bool = False
    issues: list[str] = Field(default_factory=list)


# DNSBL models
class DnsblListing(BaseModel):
    """Information about a DNSBL listing."""

    zone: str
    listed: bool = False
    return_code: str | None = None
    meaning: str | None = None


class DnsblInfo(BaseModel):
    """DNSBL check results."""

    ip_listings: list[DnsblListing] = Field(default_factory=list)
    domain_listings: list[DnsblListing] = Field(default_factory=list)
    total_listings: int = 0
    issues: list[str] = Field(default_factory=list)


# SMTP TLS models
class SmtpTlsStatus(str, Enum):
    """SMTP TLS status."""

    MODERN = "modern"
    DEGRADED = "degraded"
    ABSENT = "absent"
    UNKNOWN = "unknown"


class SmtpTlsInfo(BaseModel):
    """SMTP TLS analysis results."""

    status: SmtpTlsStatus = SmtpTlsStatus.UNKNOWN
    mx_host: str | None = None
    starttls_supported: bool = False
    certificate_valid: bool = False
    certificate_hostname_match: bool = False
    tls_version: str | None = None
    issues: list[str] = Field(default_factory=list)


# MX Inference models
class InferredProvider(str, Enum):
    """Inferred email provider from MX records."""

    GOOGLE = "google"
    MICROSOFT = "microsoft"
    PROOFPOINT = "proofpoint"
    MIMECAST = "mimecast"
    BARRACUDA = "barracuda"
    CISCO = "cisco"
    OTHER = "other"


class ProviderSensitivity(BaseModel):
    """Provider sensitivity profile."""

    name: str
    dkim_strict: bool = False
    dmarc_strict: bool = False
    anti_spoofing: bool = False
    impersonation_detection: bool = False
    notes: str | None = None


class MxInferenceInfo(BaseModel):
    """MX inference analysis results."""

    mx_records: list[dict] = Field(default_factory=list)
    inferred_provider: InferredProvider = InferredProvider.OTHER
    sensitivity: ProviderSensitivity | None = None


# Behavioral models
class BehavioralRisk(str, Enum):
    """Behavioral risk level."""

    LOW = "low"
    MEDIUM = "medium"
    ELEVATED = "elevated"


class BehavioralInfo(BaseModel):
    """Behavioral analysis results."""

    risk: BehavioralRisk = BehavioralRisk.LOW
    domain_age_days: int | None = None
    is_new_domain: bool = False
    issues: list[str] = Field(default_factory=list)


# Risk models
class RiskLevel(str, Enum):
    """Overall risk level."""

    LOW = "low"
    MEDIUM = "medium"
    MEDIUM_HIGH = "medium_high"
    HIGH = "high"
    CRITICAL = "critical"


class RiskInfo(BaseModel):
    """Overall risk assessment."""

    overall_risk: RiskLevel = RiskLevel.LOW
    score: int = 0
    likely_failure_modes: list[str] = Field(default_factory=list)
    can_rule_out: list[str] = Field(default_factory=list)
    cannot_determine: list[str] = Field(default_factory=list)


# Authentication posture summary
class AuthPosture(BaseModel):
    """Authentication posture summary."""

    spf: SpfInfo | None = None
    dkim: DkimInfo | None = None
    dmarc: DmarcInfo | None = None


# Infrastructure summary
class InfrastructureTrust(BaseModel):
    """Infrastructure trust summary."""

    ptr: PtrInfo | None = None
    helo_consistent: bool | None = None
    smtp_tls: SmtpTlsInfo | None = None


# Main report
class EmailReputationReport(BaseModel):
    """Complete email reputation analysis report."""

    domain: str
    queried_at: datetime
    cached: bool = False
    options: dict = Field(default_factory=dict)

    # Results sections
    risk: RiskInfo | None = None
    auth: AuthPosture | None = None
    infrastructure: InfrastructureTrust | None = None
    reputation: DnsblInfo | None = None
    provider: MxInferenceInfo | None = None
    behavioral: BehavioralInfo | None = None

    errors: list[str] = Field(default_factory=list)
