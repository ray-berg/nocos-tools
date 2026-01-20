"""Pydantic models for Security Headers Analyzer."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class Grade(str, Enum):
    """Security header grade."""

    A_PLUS = "A+"
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    F = "F"


class RunRequest(BaseModel):
    """Request model for security headers analysis."""

    url: str = Field(..., description="URL to analyze")
    follow_redirects: bool = Field(default=True, description="Follow redirects")


class HeaderAnalysis(BaseModel):
    """Analysis of a single security header."""

    name: str
    present: bool
    value: str | None = None
    grade: Grade
    description: str
    recommendation: str | None = None
    details: list[str] = Field(default_factory=list)


class SecurityHeadersReport(BaseModel):
    """Complete security headers analysis report."""

    url: str
    final_url: str
    queried_at: datetime
    overall_grade: Grade
    overall_score: int = Field(ge=0, le=100)
    headers_analyzed: list[HeaderAnalysis] = Field(default_factory=list)
    raw_headers: dict[str, str] = Field(default_factory=dict)
    redirect_chain: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
