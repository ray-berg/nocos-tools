"""Tests for DKIM collector."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.tools.email_reputation.collectors.dkim import DkimCollector
from app.tools.email_reputation.models import DkimStatus


class TestDkimCollector:
    """Tests for DkimCollector class."""

    @pytest.mark.asyncio
    async def test_dkim_found_single_selector(self):
        """Test finding a single DKIM selector."""
        collector = DkimCollector("example.com")

        mock_answer = MagicMock()
        mock_answer.strings = [b"v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ"]

        with patch(
            "app.tools.email_reputation.collectors.dkim.dns.asyncresolver.Resolver"
        ) as mock_resolver_class:
            mock_resolver = MagicMock()

            async def resolve_side_effect(domain, rtype):
                if "selector1._domainkey" in domain:
                    return [mock_answer]
                raise Exception("Not found")

            mock_resolver.resolve = AsyncMock(side_effect=resolve_side_effect)
            mock_resolver_class.return_value = mock_resolver

            result = await collector.run()

            assert result.data is not None
            assert result.data.status == DkimStatus.PRESENT
            assert len(result.data.selectors_found) >= 1
            assert any(s.selector == "selector1" for s in result.data.selectors_found)

    @pytest.mark.asyncio
    async def test_dkim_not_found(self):
        """Test when no DKIM selectors are found."""
        import dns.resolver

        collector = DkimCollector("example.com")

        with patch(
            "app.tools.email_reputation.collectors.dkim.dns.asyncresolver.Resolver"
        ) as mock_resolver_class:
            mock_resolver = MagicMock()
            mock_resolver.resolve = AsyncMock(side_effect=dns.resolver.NXDOMAIN())
            mock_resolver_class.return_value = mock_resolver

            result = await collector.run()

            assert result.data is not None
            assert result.data.status == DkimStatus.UNKNOWN
            assert len(result.data.selectors_found) == 0

    @pytest.mark.asyncio
    async def test_dkim_multiple_selectors(self):
        """Test finding multiple DKIM selectors."""
        collector = DkimCollector("example.com")

        mock_answer1 = MagicMock()
        mock_answer1.strings = [b"v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ"]
        mock_answer2 = MagicMock()
        mock_answer2.strings = [b"v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ"]

        with patch(
            "app.tools.email_reputation.collectors.dkim.dns.asyncresolver.Resolver"
        ) as mock_resolver_class:
            mock_resolver = MagicMock()

            async def resolve_side_effect(domain, rtype):
                if "selector1._domainkey" in domain:
                    return [mock_answer1]
                if "selector2._domainkey" in domain:
                    return [mock_answer2]
                import dns.resolver
                raise dns.resolver.NXDOMAIN()

            mock_resolver.resolve = AsyncMock(side_effect=resolve_side_effect)
            mock_resolver_class.return_value = mock_resolver

            result = await collector.run()

            assert result.data is not None
            assert result.data.status == DkimStatus.PRESENT
            assert len(result.data.selectors_found) >= 2

    def test_parse_dkim_record_rsa(self):
        """Test parsing DKIM record with RSA key."""
        collector = DkimCollector("example.com")

        # Minimal DKIM record
        record = "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ"
        result = collector._parse_dkim_record("default", record)

        assert result.selector == "default"
        assert result.key_type == "rsa"

    def test_parse_dkim_record_no_key_type(self):
        """Test parsing DKIM record without explicit key type."""
        collector = DkimCollector("example.com")

        # DKIM record without k= (defaults to rsa per RFC)
        record = "v=DKIM1; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ"
        result = collector._parse_dkim_record("default", record)

        assert result.key_type == "rsa"

    def test_common_selectors_list(self):
        """Test that common selectors are defined."""
        collector = DkimCollector("example.com")

        # Verify key providers are represented
        assert "selector1" in collector.COMMON_SELECTORS  # Microsoft
        assert "selector2" in collector.COMMON_SELECTORS  # Microsoft
        assert "google" in collector.COMMON_SELECTORS  # Google
        assert "default" in collector.COMMON_SELECTORS  # Common
        assert "k1" in collector.COMMON_SELECTORS  # Mailchimp
