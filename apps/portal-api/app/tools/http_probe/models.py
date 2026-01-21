"""Pydantic models for HTTP Probe tool."""

from pydantic import BaseModel, Field
from typing import Optional, Dict, List


class HttpProbeRequest(BaseModel):
    """Request to probe a URL."""
    url: str = Field(..., description="URL to probe")
    method: str = Field(default="GET", description="HTTP method")
    headers: Optional[Dict[str, str]] = Field(default=None, description="Custom headers")
    follow_redirects: bool = Field(default=True, description="Follow redirects")
    max_redirects: int = Field(default=10, description="Maximum redirects to follow")


class TimingInfo(BaseModel):
    """Request timing breakdown."""
    dns_lookup_ms: Optional[float] = Field(None, description="DNS lookup time in ms")
    tcp_connect_ms: Optional[float] = Field(None, description="TCP connect time in ms")
    tls_handshake_ms: Optional[float] = Field(None, description="TLS handshake time in ms")
    time_to_first_byte_ms: Optional[float] = Field(None, description="Time to first byte in ms")
    content_download_ms: Optional[float] = Field(None, description="Content download time in ms")
    total_ms: float = Field(..., description="Total request time in ms")


class RedirectHop(BaseModel):
    """Information about a redirect hop."""
    url: str
    status_code: int
    location: Optional[str] = None


class ResponseInfo(BaseModel):
    """Response information."""
    status_code: int
    status_text: str
    http_version: str
    headers: Dict[str, str]
    content_type: Optional[str] = None
    content_length: Optional[int] = None
    content_encoding: Optional[str] = None
    body_preview: Optional[str] = Field(None, description="Truncated body preview")
    body_size: int = Field(0, description="Actual body size in bytes")


class HttpProbeResponse(BaseModel):
    """Complete HTTP probe response."""
    request_url: str
    final_url: str
    method: str
    timing: TimingInfo
    response: ResponseInfo
    redirects: List[RedirectHop] = Field(default_factory=list)
    tls_used: bool = False
    error: Optional[str] = None
