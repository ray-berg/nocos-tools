"""Pydantic models for IP/ASN Lookup tool."""

from pydantic import BaseModel, Field
from typing import Optional


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


class IPLookupResponse(BaseModel):
    """Complete IP lookup response."""
    ip: str
    ip_type: IPTypeInfo
    geolocation: Optional[GeoLocation] = None
    asn: Optional[ASNInfo] = None
    network: Optional[NetworkInfo] = None
    error: Optional[str] = None
