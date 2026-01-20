"""Pydantic models for SSL Certificate Inspector."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class CertificateStatus(str, Enum):
    """Certificate validity status."""

    VALID = "valid"
    EXPIRING_SOON = "expiring_soon"
    EXPIRED = "expired"
    NOT_YET_VALID = "not_yet_valid"
    INVALID = "invalid"


class RunRequest(BaseModel):
    """Request model for SSL inspection."""

    hostname: str = Field(..., description="Hostname to inspect")
    port: int = Field(default=443, ge=1, le=65535, description="Port number")


class CertificateInfo(BaseModel):
    """Information about a single certificate."""

    subject: dict[str, str] = Field(default_factory=dict)
    issuer: dict[str, str] = Field(default_factory=dict)
    serial_number: str | None = None
    version: int | None = None
    not_before: datetime | None = None
    not_after: datetime | None = None
    days_until_expiry: int | None = None
    status: CertificateStatus = CertificateStatus.INVALID
    subject_alt_names: list[str] = Field(default_factory=list)
    key_type: str | None = None
    key_bits: int | None = None
    signature_algorithm: str | None = None
    fingerprint_sha256: str | None = None
    fingerprint_sha1: str | None = None
    is_self_signed: bool = False
    is_ca: bool = False


class ChainInfo(BaseModel):
    """Information about the certificate chain."""

    certificates: list[CertificateInfo] = Field(default_factory=list)
    chain_valid: bool = False
    chain_complete: bool = False
    issues: list[str] = Field(default_factory=list)


class ConnectionInfo(BaseModel):
    """TLS connection information."""

    protocol_version: str | None = None
    cipher_suite: str | None = None
    cipher_bits: int | None = None
    server_hostname: str | None = None
    alpn_protocol: str | None = None


class SslInspectorReport(BaseModel):
    """Complete SSL inspection report."""

    hostname: str
    port: int
    queried_at: datetime
    connection: ConnectionInfo | None = None
    certificate: CertificateInfo | None = None
    chain: ChainInfo | None = None
    errors: list[str] = Field(default_factory=list)
