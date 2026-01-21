"""Pydantic models for Traceroute tool."""

from pydantic import BaseModel, Field
from typing import Optional, List


class TracerouteRequest(BaseModel):
    """Request to run a traceroute."""
    target: str = Field(..., description="IP address or FQDN to trace")
    max_hops: int = Field(default=30, ge=1, le=64, description="Maximum number of hops")


class GeoLocation(BaseModel):
    """Geographic location for a hop."""
    latitude: float
    longitude: float
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None


class HopInfo(BaseModel):
    """Information about a single hop in the traceroute."""
    hop_number: int
    ip: Optional[str] = None
    hostname: Optional[str] = None
    rtt_ms: Optional[List[float]] = Field(default=None, description="Round-trip times in ms")
    avg_rtt_ms: Optional[float] = None
    is_timeout: bool = False
    is_private: bool = False
    geolocation: Optional[GeoLocation] = None
    asn: Optional[int] = None
    as_name: Optional[str] = None
    isp: Optional[str] = None


class RouteExplanation(BaseModel):
    """Explanation of the route."""
    summary: str
    segments: List[str] = Field(default_factory=list)
    total_hops: int
    responsive_hops: int
    countries_traversed: List[str] = Field(default_factory=list)
    estimated_distance_km: Optional[float] = None


class TracerouteResponse(BaseModel):
    """Complete traceroute response."""
    target: str
    resolved_ip: Optional[str] = None
    hops: List[HopInfo] = Field(default_factory=list)
    explanation: Optional[RouteExplanation] = None
    completed: bool = False
    error: Optional[str] = None
