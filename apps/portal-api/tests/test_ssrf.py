import pytest

from app.tools.url_inspector.ssrf import SSRFError, is_ip_blocked, resolve_and_validate, validate_url


class TestIsIpBlocked:
    """Test IP blocking logic."""

    def test_loopback_blocked(self):
        assert is_ip_blocked("127.0.0.1") is True
        assert is_ip_blocked("127.0.0.255") is True
        assert is_ip_blocked("::1") is True

    def test_private_ranges_blocked(self):
        # RFC1918 ranges
        assert is_ip_blocked("10.0.0.1") is True
        assert is_ip_blocked("10.255.255.255") is True
        assert is_ip_blocked("172.16.0.1") is True
        assert is_ip_blocked("172.31.255.255") is True
        assert is_ip_blocked("192.168.0.1") is True
        assert is_ip_blocked("192.168.255.255") is True

    def test_link_local_blocked(self):
        assert is_ip_blocked("169.254.0.1") is True
        assert is_ip_blocked("169.254.169.254") is True  # Cloud metadata

    def test_public_ips_allowed(self):
        assert is_ip_blocked("8.8.8.8") is False
        assert is_ip_blocked("1.1.1.1") is False
        assert is_ip_blocked("93.184.216.34") is False  # example.com


class TestValidateUrl:
    """Test URL validation."""

    def test_valid_https_url(self):
        url = validate_url("https://example.com/path")
        assert url == "https://example.com/path"

    def test_valid_http_url(self):
        url = validate_url("http://example.com")
        assert url == "http://example.com"

    def test_invalid_scheme_rejected(self):
        with pytest.raises(SSRFError, match="Scheme.*not allowed"):
            validate_url("ftp://example.com")

        with pytest.raises(SSRFError, match="Scheme.*not allowed"):
            validate_url("file:///etc/passwd")

        with pytest.raises(SSRFError, match="Scheme.*not allowed"):
            validate_url("gopher://example.com")

    def test_localhost_rejected(self):
        with pytest.raises(SSRFError, match="not allowed"):
            validate_url("http://localhost/")

        with pytest.raises(SSRFError, match="not allowed"):
            validate_url("http://localhost:8080/")

    def test_private_ip_rejected(self):
        with pytest.raises(SSRFError, match="blocked range"):
            validate_url("http://127.0.0.1/")

        with pytest.raises(SSRFError, match="blocked range"):
            validate_url("http://192.168.1.1/")

        with pytest.raises(SSRFError, match="blocked range"):
            validate_url("http://10.0.0.1/")

    def test_metadata_ip_rejected(self):
        with pytest.raises(SSRFError, match="blocked range"):
            validate_url("http://169.254.169.254/latest/meta-data/")


class TestResolveAndValidate:
    """Test DNS resolution and validation."""

    def test_localhost_hostname_rejected(self):
        with pytest.raises(SSRFError, match="not allowed"):
            resolve_and_validate("localhost")

    def test_direct_ip_validation(self):
        # Public IP should pass
        ips = resolve_and_validate("8.8.8.8")
        assert "8.8.8.8" in ips

        # Private IP should fail
        with pytest.raises(SSRFError, match="blocked range"):
            resolve_and_validate("192.168.1.1")

    def test_loopback_ipv6_rejected(self):
        with pytest.raises(SSRFError, match="blocked range"):
            resolve_and_validate("::1")


@pytest.mark.asyncio
async def test_fetch_head_ssrf_localhost(client):
    """Test that localhost is blocked in fetch-head endpoint."""
    response = await client.post(
        "/api/tools/url-inspector/fetch-head",
        json={"url": "http://localhost/"},
    )
    assert response.status_code == 400
    assert "not allowed" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_fetch_head_ssrf_private_ip(client):
    """Test that private IPs are blocked in fetch-head endpoint."""
    response = await client.post(
        "/api/tools/url-inspector/fetch-head",
        json={"url": "http://192.168.1.1/"},
    )
    assert response.status_code == 400
    assert "blocked" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_fetch_head_ssrf_metadata_ip(client):
    """Test that cloud metadata IP is blocked."""
    response = await client.post(
        "/api/tools/url-inspector/fetch-head",
        json={"url": "http://169.254.169.254/latest/meta-data/"},
    )
    assert response.status_code == 400
    assert "blocked" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_fetch_head_ssrf_loopback(client):
    """Test that loopback addresses are blocked."""
    response = await client.post(
        "/api/tools/url-inspector/fetch-head",
        json={"url": "http://127.0.0.1:8080/"},
    )
    assert response.status_code == 400
    assert "blocked" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_fetch_head_invalid_scheme(client):
    """Test that non-http(s) schemes are rejected."""
    response = await client.post(
        "/api/tools/url-inspector/fetch-head",
        json={"url": "ftp://example.com/"},
    )
    # Pydantic will reject this as invalid HttpUrl
    assert response.status_code == 422
