"""Tests for domain interrogator router endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def async_client():
    """Create async test client."""
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


class TestPresetsEndpoint:
    """Tests for GET /api/tools/domain-interrogator/presets."""

    @pytest.mark.asyncio
    async def test_presets_returns_defaults(self, async_client):
        """Test that presets endpoint returns default options."""
        async with async_client as client:
            response = await client.get("/api/tools/domain-interrogator/presets")

        assert response.status_code == 200
        data = response.json()

        assert "default_include_web" in data
        assert "default_include_ct" in data
        assert "default_include_dnssec" in data
        assert "cache_ttl_seconds" in data

        assert isinstance(data["default_include_web"], bool)
        assert isinstance(data["default_include_ct"], bool)
        assert isinstance(data["default_include_dnssec"], bool)
        assert isinstance(data["cache_ttl_seconds"], int)
        assert data["cache_ttl_seconds"] > 0


class TestRunEndpoint:
    """Tests for POST /api/tools/domain-interrogator/run."""

    @pytest.mark.asyncio
    async def test_rejects_empty_domain(self, async_client):
        """Test rejection of empty domain."""
        async with async_client as client:
            response = await client.post(
                "/api/tools/domain-interrogator/run",
                json={"domain": ""},
            )

        assert response.status_code == 422  # Pydantic validation error

    @pytest.mark.asyncio
    async def test_rejects_ipv4_address(self, async_client):
        """Test rejection of IPv4 address."""
        async with async_client as client:
            response = await client.post(
                "/api/tools/domain-interrogator/run",
                json={"domain": "192.168.1.1"},
            )

        assert response.status_code == 400
        assert "IP addresses" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_rejects_localhost(self, async_client):
        """Test rejection of localhost IP."""
        async with async_client as client:
            response = await client.post(
                "/api/tools/domain-interrogator/run",
                json={"domain": "127.0.0.1"},
            )

        assert response.status_code == 400
        assert "IP addresses" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_rejects_private_ip(self, async_client):
        """Test rejection of private IP ranges."""
        async with async_client as client:
            response = await client.post(
                "/api/tools/domain-interrogator/run",
                json={"domain": "10.0.0.1"},
            )

        assert response.status_code == 400
        assert "IP addresses" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_rejects_url_with_scheme(self, async_client):
        """Test rejection of URL with scheme."""
        async with async_client as client:
            response = await client.post(
                "/api/tools/domain-interrogator/run",
                json={"domain": "https://example.com"},
            )

        assert response.status_code == 400
        assert "scheme" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_rejects_wildcard(self, async_client):
        """Test rejection of wildcard domain."""
        async with async_client as client:
            response = await client.post(
                "/api/tools/domain-interrogator/run",
                json={"domain": "*.example.com"},
            )

        assert response.status_code == 400
        assert "Wildcard" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_accepts_valid_domain(self, async_client):
        """Test acceptance of valid domain."""
        async with async_client as client:
            response = await client.post(
                "/api/tools/domain-interrogator/run",
                json={
                    "domain": "example.com",
                    "include_web": False,
                    "include_ct": False,
                    "include_dnssec": False,
                },
            )

        # Should return 200 even if some collectors fail
        assert response.status_code == 200
        data = response.json()

        assert data["domain"] == "example.com"
        assert "queried_at" in data
        assert "options" in data

    @pytest.mark.asyncio
    async def test_normalizes_domain(self, async_client):
        """Test domain normalization."""
        async with async_client as client:
            response = await client.post(
                "/api/tools/domain-interrogator/run",
                json={
                    "domain": "  EXAMPLE.COM.  ",
                    "include_web": False,
                    "include_ct": False,
                    "include_dnssec": False,
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert data["domain"] == "example.com"
