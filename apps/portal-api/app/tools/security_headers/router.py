"""FastAPI router for Security Headers Analyzer."""

import ipaddress
import socket
from datetime import UTC, datetime
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException

from app.registry import tool_registry
from app.tools.security_headers.metadata import TOOL_METADATA
from app.tools.security_headers.models import (
    Grade,
    HeaderAnalysis,
    RunRequest,
    SecurityHeadersReport,
)

router = APIRouter()

# Private IP ranges for SSRF protection
PRIVATE_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def is_private_ip(ip: str) -> bool:
    """Check if an IP is private."""
    try:
        addr = ipaddress.ip_address(ip)
        return any(addr in network for network in PRIVATE_RANGES)
    except ValueError:
        return False


def validate_url(url: str) -> str:
    """Validate and normalize URL, checking for SSRF."""
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only HTTP/HTTPS URLs are allowed")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid URL: no hostname")

    # Resolve hostname and check for private IPs
    try:
        ips = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        for family, _, _, _, sockaddr in ips:
            ip = sockaddr[0]
            if is_private_ip(ip):
                raise HTTPException(
                    status_code=400,
                    detail="URLs pointing to private/internal IPs are not allowed",
                )
    except socket.gaierror as e:
        raise HTTPException(status_code=400, detail=f"DNS resolution failed: {e}") from None

    return url


def analyze_csp(value: str | None) -> HeaderAnalysis:
    """Analyze Content-Security-Policy header."""
    analysis = HeaderAnalysis(
        name="Content-Security-Policy",
        present=value is not None,
        value=value,
        grade=Grade.F,
        description="Helps prevent XSS, clickjacking, and code injection attacks",
    )

    if not value:
        analysis.recommendation = "Add a Content-Security-Policy header to control resource loading"
        return analysis

    # Parse directives
    directives = {}
    for part in value.split(";"):
        part = part.strip()
        if not part:
            continue
        tokens = part.split()
        if tokens:
            directives[tokens[0].lower()] = tokens[1:] if len(tokens) > 1 else []

    score = 0
    issues = []

    # Check for unsafe-inline and unsafe-eval
    for directive in ["script-src", "default-src", "style-src"]:
        sources = directives.get(directive, [])
        if "'unsafe-inline'" in sources:
            issues.append(f"{directive} allows 'unsafe-inline'")
        elif directive in directives:
            score += 10
        if "'unsafe-eval'" in sources:
            issues.append(f"{directive} allows 'unsafe-eval'")

    # Check for important directives
    if "default-src" in directives:
        score += 20
    if "script-src" in directives:
        score += 15
    if "object-src" in directives:
        score += 10
        if directives["object-src"] == ["'none'"]:
            score += 5
    if "frame-ancestors" in directives:
        score += 10
    if "base-uri" in directives:
        score += 10
    if "form-action" in directives:
        score += 10

    # Determine grade
    if score >= 70 and not issues:
        analysis.grade = Grade.A
    elif score >= 50:
        analysis.grade = Grade.B
    elif score >= 30:
        analysis.grade = Grade.C
    elif score >= 10:
        analysis.grade = Grade.D
    else:
        analysis.grade = Grade.F

    analysis.details = issues
    if issues:
        analysis.recommendation = "Consider removing unsafe-inline and unsafe-eval"

    return analysis


def analyze_hsts(value: str | None) -> HeaderAnalysis:
    """Analyze Strict-Transport-Security header."""
    analysis = HeaderAnalysis(
        name="Strict-Transport-Security",
        present=value is not None,
        value=value,
        grade=Grade.F,
        description="Ensures browsers only connect over HTTPS",
    )

    if not value:
        analysis.recommendation = "Add HSTS header with at least max-age=31536000"
        return analysis

    # Parse directives
    directives = {}
    for part in value.split(";"):
        part = part.strip().lower()
        if "=" in part:
            key, val = part.split("=", 1)
            directives[key.strip()] = val.strip()
        elif part:
            directives[part] = True

    max_age = int(directives.get("max-age", 0))
    include_subdomains = "includesubdomains" in directives
    preload = "preload" in directives

    if max_age >= 31536000:  # 1 year
        if include_subdomains and preload:
            analysis.grade = Grade.A_PLUS
            analysis.details.append("Eligible for HSTS preload list")
        elif include_subdomains:
            analysis.grade = Grade.A
        else:
            analysis.grade = Grade.B
            analysis.recommendation = "Consider adding includeSubDomains"
    elif max_age >= 15768000:  # 6 months
        analysis.grade = Grade.B
        analysis.recommendation = "Increase max-age to at least 1 year (31536000)"
    elif max_age >= 2592000:  # 30 days
        analysis.grade = Grade.C
        analysis.recommendation = "Increase max-age to at least 1 year (31536000)"
    elif max_age > 0:
        analysis.grade = Grade.D
        analysis.recommendation = "max-age is too short"
    else:
        analysis.grade = Grade.F
        analysis.recommendation = "Add valid max-age directive"

    return analysis


def analyze_x_frame_options(value: str | None) -> HeaderAnalysis:
    """Analyze X-Frame-Options header."""
    analysis = HeaderAnalysis(
        name="X-Frame-Options",
        present=value is not None,
        value=value,
        grade=Grade.F,
        description="Protects against clickjacking attacks",
    )

    if not value:
        analysis.recommendation = "Add X-Frame-Options: DENY or SAMEORIGIN"
        return analysis

    value_upper = value.upper().strip()
    if value_upper == "DENY":
        analysis.grade = Grade.A
    elif value_upper == "SAMEORIGIN":
        analysis.grade = Grade.A
    elif value_upper.startswith("ALLOW-FROM"):
        analysis.grade = Grade.B
        analysis.details.append("ALLOW-FROM is deprecated in modern browsers")
        analysis.recommendation = "Use CSP frame-ancestors instead"
    else:
        analysis.grade = Grade.F
        analysis.recommendation = "Use DENY or SAMEORIGIN"

    return analysis


def analyze_x_content_type_options(value: str | None) -> HeaderAnalysis:
    """Analyze X-Content-Type-Options header."""
    analysis = HeaderAnalysis(
        name="X-Content-Type-Options",
        present=value is not None,
        value=value,
        grade=Grade.F,
        description="Prevents MIME type sniffing",
    )

    if not value:
        analysis.recommendation = "Add X-Content-Type-Options: nosniff"
        return analysis

    if value.lower().strip() == "nosniff":
        analysis.grade = Grade.A
    else:
        analysis.grade = Grade.F
        analysis.recommendation = "Value should be 'nosniff'"

    return analysis


def analyze_referrer_policy(value: str | None) -> HeaderAnalysis:
    """Analyze Referrer-Policy header."""
    analysis = HeaderAnalysis(
        name="Referrer-Policy",
        present=value is not None,
        value=value,
        grade=Grade.F,
        description="Controls how much referrer information is sent",
    )

    if not value:
        analysis.recommendation = "Add Referrer-Policy: strict-origin-when-cross-origin"
        return analysis

    strict_policies = [
        "no-referrer",
        "same-origin",
        "strict-origin",
        "strict-origin-when-cross-origin",
    ]
    moderate_policies = ["origin", "origin-when-cross-origin"]
    weak_policies = ["no-referrer-when-downgrade", "unsafe-url"]

    value_lower = value.lower().strip()
    if value_lower in strict_policies:
        analysis.grade = Grade.A
    elif value_lower in moderate_policies:
        analysis.grade = Grade.B
    elif value_lower in weak_policies:
        analysis.grade = Grade.D
        analysis.recommendation = "Consider using a stricter policy"
    else:
        analysis.grade = Grade.F
        analysis.recommendation = "Invalid Referrer-Policy value"

    return analysis


def analyze_permissions_policy(value: str | None) -> HeaderAnalysis:
    """Analyze Permissions-Policy header."""
    analysis = HeaderAnalysis(
        name="Permissions-Policy",
        present=value is not None,
        value=value,
        grade=Grade.F,
        description="Controls browser feature permissions",
    )

    if not value:
        analysis.recommendation = "Add Permissions-Policy to restrict browser features"
        analysis.grade = Grade.C  # Not critical, so not F
        return analysis

    # Parse and count restricted features
    features = value.split(",")
    restricted_count = 0
    for feature in features:
        feature = feature.strip()
        if "=()" in feature:
            restricted_count += 1

    if restricted_count >= 5:
        analysis.grade = Grade.A
    elif restricted_count >= 3:
        analysis.grade = Grade.B
    elif restricted_count >= 1:
        analysis.grade = Grade.C
    else:
        analysis.grade = Grade.D

    return analysis


def analyze_x_xss_protection(value: str | None) -> HeaderAnalysis:
    """Analyze X-XSS-Protection header."""
    analysis = HeaderAnalysis(
        name="X-XSS-Protection",
        present=value is not None,
        value=value,
        grade=Grade.C,  # Deprecated header
        description="Legacy XSS filter (deprecated in modern browsers)",
    )

    analysis.details.append("This header is deprecated and can cause security issues")
    analysis.recommendation = "Consider removing; use Content-Security-Policy instead"

    if value:
        if value.strip() == "0":
            analysis.grade = Grade.B
            analysis.details.append("XSS filter disabled (recommended)")
        elif "mode=block" in value:
            analysis.grade = Grade.C
        else:
            analysis.grade = Grade.D

    return analysis


def calculate_overall_grade(analyses: list[HeaderAnalysis]) -> tuple[Grade, int]:
    """Calculate overall grade from individual header analyses."""
    grade_scores = {
        Grade.A_PLUS: 100,
        Grade.A: 90,
        Grade.B: 75,
        Grade.C: 60,
        Grade.D: 40,
        Grade.F: 0,
    }

    weights = {
        "Content-Security-Policy": 25,
        "Strict-Transport-Security": 25,
        "X-Frame-Options": 15,
        "X-Content-Type-Options": 15,
        "Referrer-Policy": 10,
        "Permissions-Policy": 10,
    }

    total_weight = 0
    weighted_score = 0

    for analysis in analyses:
        weight = weights.get(analysis.name, 0)
        if weight > 0:
            total_weight += weight
            weighted_score += grade_scores[analysis.grade] * weight

    if total_weight == 0:
        return Grade.F, 0

    score = int(weighted_score / total_weight)

    if score >= 90:
        grade = Grade.A
    elif score >= 75:
        grade = Grade.B
    elif score >= 60:
        grade = Grade.C
    elif score >= 40:
        grade = Grade.D
    else:
        grade = Grade.F

    return grade, score


@router.post("/run", response_model=SecurityHeadersReport)
async def run_analysis(request: RunRequest) -> SecurityHeadersReport:
    """
    Analyze security headers for a URL.

    Fetches headers and evaluates security posture.
    """
    # Validate URL
    validated_url = validate_url(request.url)

    report = SecurityHeadersReport(
        url=request.url,
        final_url=request.url,
        queried_at=datetime.now(UTC),
        overall_grade=Grade.F,
        overall_score=0,
    )

    try:
        async with httpx.AsyncClient(
            follow_redirects=request.follow_redirects,
            timeout=10.0,
            verify=True,
        ) as client:
            response = await client.get(validated_url)

            # Track redirects
            report.final_url = str(response.url)
            if response.history:
                report.redirect_chain = [str(r.url) for r in response.history]
                report.redirect_chain.append(str(response.url))

            # Get headers (case-insensitive)
            headers = {k.lower(): v for k, v in response.headers.items()}
            report.raw_headers = dict(response.headers)

            # Analyze each security header
            analyses = [
                analyze_csp(headers.get("content-security-policy")),
                analyze_hsts(headers.get("strict-transport-security")),
                analyze_x_frame_options(headers.get("x-frame-options")),
                analyze_x_content_type_options(headers.get("x-content-type-options")),
                analyze_referrer_policy(headers.get("referrer-policy")),
                analyze_permissions_policy(
                    headers.get("permissions-policy") or headers.get("feature-policy")
                ),
                analyze_x_xss_protection(headers.get("x-xss-protection")),
            ]

            report.headers_analyzed = analyses
            report.overall_grade, report.overall_score = calculate_overall_grade(analyses)

    except httpx.TimeoutException:
        report.errors.append("Request timed out")
    except httpx.ConnectError as e:
        report.errors.append(f"Connection error: {e}")
    except Exception as e:
        report.errors.append(f"Error: {e}")

    return report


# Register tool
tool_registry.register(TOOL_METADATA, router)
