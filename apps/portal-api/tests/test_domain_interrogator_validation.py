"""Tests for domain interrogator validation."""

import pytest

from app.tools.domain_interrogator.validation import (
    DomainValidationError,
    is_valid_domain,
    validate_domain,
)


class TestValidateDomain:
    """Tests for validate_domain function."""

    def test_valid_domain(self):
        """Test valid domain names."""
        assert validate_domain("example.com") == "example.com"
        assert validate_domain("sub.example.com") == "sub.example.com"
        assert validate_domain("EXAMPLE.COM") == "example.com"
        assert validate_domain("example.co.uk") == "example.co.uk"
        assert validate_domain("a.b.c.example.com") == "a.b.c.example.com"

    def test_trailing_dot(self):
        """Test domain with trailing dot is normalized."""
        assert validate_domain("example.com.") == "example.com"

    def test_whitespace(self):
        """Test domain with whitespace is trimmed."""
        assert validate_domain("  example.com  ") == "example.com"

    def test_rejects_ipv4(self):
        """Test rejection of IPv4 addresses."""
        with pytest.raises(DomainValidationError, match="IP addresses"):
            validate_domain("192.168.1.1")
        with pytest.raises(DomainValidationError, match="IP addresses"):
            validate_domain("10.0.0.1")
        with pytest.raises(DomainValidationError, match="IP addresses"):
            validate_domain("127.0.0.1")

    def test_rejects_ipv6(self):
        """Test rejection of IPv6 addresses."""
        with pytest.raises(DomainValidationError, match="IPv6"):
            validate_domain("::1")
        with pytest.raises(DomainValidationError, match="IPv6"):
            validate_domain("2001:db8::1")

    def test_rejects_url_with_scheme(self):
        """Test rejection of URLs with schemes."""
        with pytest.raises(DomainValidationError, match="scheme"):
            validate_domain("http://example.com")
        with pytest.raises(DomainValidationError, match="scheme"):
            validate_domain("https://example.com")
        with pytest.raises(DomainValidationError, match="scheme"):
            validate_domain("ftp://example.com")

    def test_rejects_url_with_path(self):
        """Test rejection of URLs with paths."""
        with pytest.raises(DomainValidationError, match="path"):
            validate_domain("example.com/path")
        with pytest.raises(DomainValidationError, match="path"):
            validate_domain("example.com/path/to/page")

    def test_rejects_url_with_query(self):
        """Test rejection of URLs with query strings."""
        with pytest.raises(DomainValidationError, match="query"):
            validate_domain("example.com?param=value")

    def test_rejects_url_with_fragment(self):
        """Test rejection of URLs with fragments."""
        with pytest.raises(DomainValidationError, match="fragment"):
            validate_domain("example.com#section")

    def test_rejects_wildcard(self):
        """Test rejection of wildcard domains."""
        with pytest.raises(DomainValidationError, match="Wildcard"):
            validate_domain("*.example.com")
        with pytest.raises(DomainValidationError, match="Wildcard"):
            validate_domain("sub.*.example.com")

    def test_rejects_empty(self):
        """Test rejection of empty domain."""
        with pytest.raises(DomainValidationError, match="empty"):
            validate_domain("")
        with pytest.raises(DomainValidationError, match="empty"):
            validate_domain("   ")

    def test_rejects_single_label(self):
        """Test rejection of single-label domains."""
        with pytest.raises(DomainValidationError, match="at least two labels"):
            validate_domain("localhost")
        with pytest.raises(DomainValidationError, match="at least two labels"):
            validate_domain("example")

    def test_rejects_too_long_domain(self):
        """Test rejection of domain exceeding 253 characters."""
        long_domain = "a" * 250 + ".com"
        with pytest.raises(DomainValidationError, match="too long"):
            validate_domain(long_domain)

    def test_rejects_too_long_label(self):
        """Test rejection of label exceeding 63 characters."""
        long_label = "a" * 64
        with pytest.raises(DomainValidationError, match="label too long"):
            validate_domain(f"{long_label}.com")

    def test_rejects_invalid_characters(self):
        """Test rejection of invalid characters."""
        with pytest.raises(DomainValidationError, match="Invalid characters"):
            validate_domain("exam_ple.com")
        with pytest.raises(DomainValidationError, match="Invalid characters"):
            validate_domain("example!.com")

    def test_punycode_domain(self):
        """Test acceptance of punycode domains."""
        # xn--nxasmq5b.com is punycode for a non-ASCII domain
        assert validate_domain("xn--nxasmq5b.com") == "xn--nxasmq5b.com"

    def test_removes_port(self):
        """Test removal of port number."""
        assert validate_domain("example.com:443") == "example.com"
        assert validate_domain("example.com:8080") == "example.com"


class TestIsValidDomain:
    """Tests for is_valid_domain helper function."""

    def test_valid_domain_returns_true(self):
        """Test that valid domains return True."""
        assert is_valid_domain("example.com") is True
        assert is_valid_domain("sub.example.com") is True

    def test_invalid_domain_returns_false(self):
        """Test that invalid domains return False."""
        assert is_valid_domain("") is False
        assert is_valid_domain("192.168.1.1") is False
        assert is_valid_domain("http://example.com") is False
        assert is_valid_domain("*.example.com") is False
