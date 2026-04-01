"""Pydantic models for IP/ASN Lookup tool."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class IPLookupRequest(BaseModel):
    """Request to look up IP information."""
    ip: str = Field(..., description="IP address (v4 or v6)")


class GeoLocation(BaseModel):
    """Geographic location data."""
    country: Optional[str] = None
    country_code: Optional[str] = None
    region: Optional[str] = None
    region_code: Optional[str] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = None


class ASNInfo(BaseModel):
    """Autonomous System Number information."""
    asn: Optional[int] = None
    as_name: Optional[str] = None
    as_org: Optional[str] = None


class IPTypeInfo(BaseModel):
    """IP address type classification."""
    version: int = Field(..., description="IP version (4 or 6)")
    is_private: bool = False
    is_loopback: bool = False
    is_multicast: bool = False
    is_reserved: bool = False
    is_link_local: bool = False


class NetworkInfo(BaseModel):
    """Network-related information."""
    ptr: Optional[str] = Field(None, description="PTR record (reverse DNS)")
    isp: Optional[str] = None
    org: Optional[str] = None
    is_hosting: Optional[bool] = None
    is_proxy: Optional[bool] = None
    is_vpn: Optional[bool] = None
    is_tor: Optional[bool] = None


class WhoisContact(BaseModel):
    """WHOIS contact information."""
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    organization: Optional[str] = None


class WhoisInfo(BaseModel):
    """WHOIS registration data for an IP address."""
    network_name: Optional[str] = Field(None, description="Network name from WHOIS")
    network_cidr: Optional[str] = Field(None, description="Network CIDR block")
    network_range: Optional[str] = Field(None, description="IP range (start - end)")
    description: Optional[str] = None
    country: Optional[str] = Field(None, description="Country code from WHOIS")
    registrant: Optional[WhoisContact] = None
    abuse_contact: Optional[WhoisContact] = None
    created_date: Optional[str] = None
    updated_date: Optional[str] = None
    registry: Optional[str] = Field(None, description="RIR (ARIN, RIPE, APNIC, etc.)")
    raw_whois: Optional[str] = Field(None, description="Raw WHOIS response snippet")


class AbuseReport(BaseModel):
    """Individual abuse report from AbuseIPDB."""
    reported_at: Optional[str] = None
    categories: list[str] = Field(default_factory=list)
    comment: Optional[str] = None
    reporter_country: Optional[str] = None


class ThreatIntelligence(BaseModel):
    """Threat intelligence data for an IP address."""
    # AbuseIPDB data
    abuse_confidence_score: Optional[int] = Field(
        None, description="AbuseIPDB confidence score (0-100)"
    )
    total_reports: Optional[int] = Field(None, description="Total abuse reports")
    num_distinct_users: Optional[int] = Field(
        None, description="Number of distinct users who reported"
    )
    last_reported_at: Optional[str] = None
    abuse_categories: list[str] = Field(
        default_factory=list, description="Categories of reported abuse"
    )
    recent_reports: list[AbuseReport] = Field(
        default_factory=list, description="Recent abuse reports"
    )
    is_whitelisted: Optional[bool] = None
    # Blocklist checks
    blocklist_hits: list[str] = Field(
        default_factory=list, description="Blocklists where this IP appears"
    )
    threat_score: Optional[int] = Field(
        None, description="Calculated threat score (0-100)"
    )
    threat_level: Optional[str] = Field(
        None, description="Threat level: low, medium, high, critical"
    )


class IPLookupResponse(BaseModel):
    """Complete IP lookup response."""
    ip: str
    ip_type: IPTypeInfo
    geolocation: Optional[GeoLocation] = None
    asn: Optional[ASNInfo] = None
    network: Optional[NetworkInfo] = None
    whois: Optional[WhoisInfo] = None
    threat_intelligence: Optional[ThreatIntelligence] = None
    error: Optional[str] = None
