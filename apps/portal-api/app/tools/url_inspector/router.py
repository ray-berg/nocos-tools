"""URL Inspector tool - backend endpoints."""

from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl

from app.core.logging import logger
from app.core.settings import settings
from app.registry import ToolMetadata, tool_registry
from app.tools.url_inspector.ssrf import SSRFError, resolve_and_validate, validate_url

# Tool metadata
TOOL_METADATA = ToolMetadata(
    id="url-inspector",
    name="URL Inspector",
    description="Parse URLs, inspect query parameters, and fetch HEAD information safely",
    category="Network",
    nav_order=20,
    tags=["url", "http", "network", "debug"],
)

# Safe headers to return (avoid leaking sensitive info)
SAFE_HEADERS = {
    "content-type",
    "content-length",
    "server",
    "date",
    "location",
    "cache-control",
    "last-modified",
    "etag",
    "x-powered-by",
}


class FetchHeadRequest(BaseModel):
    url: HttpUrl


class FetchHeadResponse(BaseModel):
    status_code: int
    final_url: str
    headers: dict[str, str]
    redirect_count: int


@tool_registry.tool(TOOL_METADATA)
class router(APIRouter):
    pass


router = APIRouter()


@router.post("/fetch-head", response_model=FetchHeadResponse)
async def fetch_head(request: FetchHeadRequest) -> FetchHeadResponse:
    """
    Perform a safe HEAD request to the specified URL.
    Includes SSRF protections to block private/internal IPs.
    """
    url = str(request.url)

    # Validate URL format and scheme
    try:
        validate_url(url)
    except SSRFError as e:
        raise HTTPException(status_code=400, detail=f"URL validation failed: {e}")

    # Resolve and validate all IPs before making request
    parsed = urlparse(url)
    hostname = parsed.hostname

    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid URL: no hostname")

    try:
        resolve_and_validate(hostname)
    except SSRFError as e:
        raise HTTPException(status_code=400, detail=f"SSRF protection: {e}")

    # Perform the HEAD request with safety limits
    redirect_count = 0
    final_url = url

    try:
        async with httpx.AsyncClient(
            timeout=settings.request_timeout,
            follow_redirects=False,
        ) as client:
            current_url = url

            for _ in range(settings.max_redirects + 1):
                # Validate each URL in redirect chain
                try:
                    validate_url(current_url)
                    current_parsed = urlparse(current_url)
                    if current_parsed.hostname:
                        resolve_and_validate(current_parsed.hostname)
                except SSRFError as e:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Redirect blocked by SSRF protection: {e}",
                    )

                response = await client.head(current_url)
                final_url = current_url

                # Check for redirect
                if response.is_redirect and "location" in response.headers:
                    redirect_count += 1
                    if redirect_count > settings.max_redirects:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Too many redirects (max {settings.max_redirects})",
                        )
                    # Get redirect location
                    location = response.headers["location"]
                    # Handle relative URLs
                    if not location.startswith(("http://", "https://")):
                        current_parsed = urlparse(current_url)
                        location = f"{current_parsed.scheme}://{current_parsed.netloc}{location}"
                    current_url = location
                else:
                    # No redirect, we're done
                    break

            # Filter headers to safe subset
            safe_headers = {
                k.lower(): v
                for k, v in response.headers.items()
                if k.lower() in SAFE_HEADERS
            }

            logger.info(f"HEAD request to {final_url}: {response.status_code}")

            return FetchHeadResponse(
                status_code=response.status_code,
                final_url=final_url,
                headers=safe_headers,
                redirect_count=redirect_count,
            )

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504, detail=f"Request timed out after {settings.request_timeout}s"
        )
    except httpx.RequestError as e:
        logger.warning(f"Request error for {url}: {e}")
        raise HTTPException(status_code=502, detail=f"Request failed: {type(e).__name__}")


# Register the router
tool_registry.register(TOOL_METADATA, router)
