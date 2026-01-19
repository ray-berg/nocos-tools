"""Pydantic models for domain interrogator requests and responses."""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class RunRequest(BaseModel):
    """Request model for domain interrogation."""

    domain: str = Field(..., description="Domain to interrogate", min_length=1, max_length=253)
    include_web: bool = Field(default=True, description="Include HTTP/HTTPS/TLS checks")
    include_ct: bool = Field(default=True, description="Include Certificate Transparency search")
    include_dnssec: bool = Field(default=True, description="Include DNSSEC validation")


class PresetsResponse(BaseModel):
    """Response model for presets endpoint."""

    default_include_web: bool
    default_include_ct: bool
    default_include_dnssec: bool
    cache_ttl_seconds: int


# RDAP Models
class RdapContact(BaseModel):
    """Contact information from RDAP."""

    name: str | None = None
    organization: str | None = None
    email: str | None = None


class RdapInfo(BaseModel):
    """RDAP/Registration information."""

    registrar: str | None = None
    creation_date: str | None = None
    expiration_date: str | None = None
    updated_date: str | None = None
    status: list[str] = Field(default_factory=list)
    nameservers: list[str] = Field(default_factory=list)
    registrant: RdapContact | None = None
    error: str | None = None


# DNS Models
class DnsRecord(BaseModel):
    """A single DNS record."""

    name: str
    type: str
    ttl: int
    value: str


class DelegationInfo(BaseModel):
    """DNS delegation information."""

    nameservers: list[str] = Field(default_factory=list)
    ns_ips: dict[str, list[str]] = Field(default_factory=dict)
    is_lame: bool = False
    lame_ns: list[str] = Field(default_factory=list)


class DnsInfo(BaseModel):
    """DNS information for a domain."""

    records: list[DnsRecord] = Field(default_factory=list)
    delegation: DelegationInfo | None = None
    error: str | None = None


# DNSSEC Models
class DnssecInfo(BaseModel):
    """DNSSEC status information."""

    enabled: bool = False
    valid: bool = False
    ds_records: list[str] = Field(default_factory=list)
    dnskey_records: list[str] = Field(default_factory=list)
    has_rrsig: bool = False
    error: str | None = None


# Mail Models
class SpfInfo(BaseModel):
    """SPF record information."""

    record: str | None = None
    exists: bool = False
    is_valid: bool = False
    mechanisms: list[str] = Field(default_factory=list)
    lookup_count: int = 0
    all_mechanism: str | None = None
    warnings: list[str] = Field(default_factory=list)


class DmarcInfo(BaseModel):
    """DMARC record information."""

    record: str | None = None
    exists: bool = False
    policy: str | None = None
    subdomain_policy: str | None = None
    pct: int = 100
    rua: list[str] = Field(default_factory=list)
    ruf: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class MtaStsInfo(BaseModel):
    """MTA-STS information."""

    exists: bool = False
    mode: str | None = None
    mx_hosts: list[str] = Field(default_factory=list)
    max_age: int | None = None
    error: str | None = None


class MailInfo(BaseModel):
    """Email configuration information."""

    mx_records: list[dict[str, Any]] = Field(default_factory=list)
    spf: SpfInfo | None = None
    dmarc: DmarcInfo | None = None
    mta_sts: MtaStsInfo | None = None
    tls_rpt: str | None = None
    error: str | None = None


# Web/TLS Models
class TlsCertInfo(BaseModel):
    """TLS certificate information."""

    subject: str
    issuer: str
    serial_number: str
    not_before: str
    not_after: str
    days_until_expiry: int
    san_domains: list[str] = Field(default_factory=list)
    is_expired: bool = False
    is_expiring_soon: bool = False


class WebInfo(BaseModel):
    """Web/TLS information."""

    http_reachable: bool = False
    https_reachable: bool = False
    http_status: int | None = None
    https_status: int | None = None
    http_redirects_to_https: bool = False
    hsts_enabled: bool = False
    hsts_max_age: int | None = None
    server_header: str | None = None
    tls_cert: TlsCertInfo | None = None
    tls_version: str | None = None
    error: str | None = None


# IP Intelligence Models
class IpIntelRecord(BaseModel):
    """IP intelligence for a single IP."""

    ip: str
    hostname: str | None = None
    city: str | None = None
    region: str | None = None
    country: str | None = None
    country_code: str | None = None
    org: str | None = None
    asn: str | None = None
    isp: str | None = None
    is_anycast: bool = False


class IpIntelInfo(BaseModel):
    """IP intelligence information."""

    records: list[IpIntelRecord] = Field(default_factory=list)
    error: str | None = None


# Subdomains Models
class SubdomainInfo(BaseModel):
    """Certificate Transparency subdomains."""

    subdomains: list[str] = Field(default_factory=list)
    total_found: int = 0
    truncated: bool = False
    error: str | None = None


# Risk Models
class RiskSeverity(str, Enum):
    """Risk severity levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class RiskFlag(BaseModel):
    """A single risk flag."""

    severity: RiskSeverity
    category: str
    message: str
    points_deducted: int = 0


class RiskInfo(BaseModel):
    """Risk assessment information."""

    score: int = 100
    grade: str = "A"
    flags: list[RiskFlag] = Field(default_factory=list)


# Main Response Model
class DomainReport(BaseModel):
    """Complete domain interrogation report."""

    domain: str
    queried_at: datetime
    cached: bool = False
    options: dict[str, bool] = Field(default_factory=dict)

    rdap: RdapInfo | None = None
    dns: DnsInfo | None = None
    dnssec: DnssecInfo | None = None
    mail: MailInfo | None = None
    web: WebInfo | None = None
    ip_intel: IpIntelInfo | None = None
    subdomains: SubdomainInfo | None = None
    risk: RiskInfo | None = None

    errors: list[str] = Field(default_factory=list)
