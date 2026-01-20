"""Tests for DNSBL collector."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.tools.email_reputation.collectors.dnsbl import DnsblCollector


class TestDnsblCollector:
    """Tests for DnsblCollector class."""

    @pytest.mark.asyncio
    async def test_dnsbl_not_listed(self):
        """Test IP/domain not listed on any DNSBL."""
        import dns.resolver

        collector = DnsblCollector("example.com", "192.0.2.1")

        with patch(
            "app.tools.email_reputation.collectors.dnsbl.dns.asyncresolver.Resolver"
        ) as mock_resolver_class:
            mock_resolver = MagicMock()
            # NXDOMAIN means not listed
            mock_resolver.resolve = AsyncMock(side_effect=dns.resolver.NXDOMAIN())
            mock_resolver_class.return_value = mock_resolver

            result = await collector.run()

            assert result.data is not None
            assert result.data.total_listings == 0
            # Should have checked domain DNSBLs
            assert len(result.data.domain_listings) > 0
            for listing in result.data.domain_listings:
                assert listing.listed is False

    @pytest.mark.asyncio
    async def test_dnsbl_ip_listed(self):
        """Test IP listed on a DNSBL."""
        import dns.resolver

        collector = DnsblCollector("example.com", "192.0.2.1")

        mock_answer = MagicMock()
        mock_answer.address = "127.0.0.2"  # Spamhaus SBL return code

        with patch(
            "app.tools.email_reputation.collectors.dnsbl.dns.asyncresolver.Resolver"
        ) as mock_resolver_class:
            mock_resolver = MagicMock()

            async def resolve_side_effect(domain, rtype):
                if "zen.spamhaus.org" in domain:
                    return [mock_answer]
                raise dns.resolver.NXDOMAIN()

            mock_resolver.resolve = AsyncMock(side_effect=resolve_side_effect)
            mock_resolver_class.return_value = mock_resolver

            result = await collector.run()

            assert result.data is not None
            assert result.data.total_listings >= 1
            # Find the Spamhaus listing
            spamhaus_listings = [
                l for l in result.data.ip_listings if l.zone == "zen.spamhaus.org"
            ]
            assert len(spamhaus_listings) == 1
            assert spamhaus_listings[0].listed is True
            assert spamhaus_listings[0].return_code == "127.0.0.2"

    @pytest.mark.asyncio
    async def test_dnsbl_domain_listed(self):
        """Test domain listed on a DNSBL."""
        import dns.resolver

        collector = DnsblCollector("malicious.example.com")

        mock_answer = MagicMock()
        mock_answer.address = "127.0.1.2"  # Spamhaus DBL spam domain

        with patch(
            "app.tools.email_reputation.collectors.dnsbl.dns.asyncresolver.Resolver"
        ) as mock_resolver_class:
            mock_resolver = MagicMock()

            async def resolve_side_effect(domain, rtype):
                if "dbl.spamhaus.org" in domain:
                    return [mock_answer]
                raise dns.resolver.NXDOMAIN()

            mock_resolver.resolve = AsyncMock(side_effect=resolve_side_effect)
            mock_resolver_class.return_value = mock_resolver

            result = await collector.run()

            assert result.data is not None
            assert result.data.total_listings >= 1
            # Find the DBL listing
            dbl_listings = [
                l for l in result.data.domain_listings if l.zone == "dbl.spamhaus.org"
            ]
            assert len(dbl_listings) == 1
            assert dbl_listings[0].listed is True

    @pytest.mark.asyncio
    async def test_dnsbl_without_ip(self):
        """Test DNSBL check without sending IP."""
        import dns.resolver

        collector = DnsblCollector("example.com")  # No IP provided

        with patch(
            "app.tools.email_reputation.collectors.dnsbl.dns.asyncresolver.Resolver"
        ) as mock_resolver_class:
            mock_resolver = MagicMock()
            mock_resolver.resolve = AsyncMock(side_effect=dns.resolver.NXDOMAIN())
            mock_resolver_class.return_value = mock_resolver

            result = await collector.run()

            assert result.data is not None
            # Should only have domain listings, no IP listings
            assert len(result.data.ip_listings) == 0
            assert len(result.data.domain_listings) > 0

    def test_spamhaus_zen_codes(self):
        """Test Spamhaus ZEN return code mappings."""
        collector = DnsblCollector("example.com")

        assert "127.0.0.2" in collector.SPAMHAUS_ZEN_CODES
        assert "SBL" in collector.SPAMHAUS_ZEN_CODES["127.0.0.2"]
        assert "127.0.0.4" in collector.SPAMHAUS_ZEN_CODES
        assert "XBL" in collector.SPAMHAUS_ZEN_CODES["127.0.0.4"]
        assert "127.0.0.10" in collector.SPAMHAUS_ZEN_CODES
        assert "PBL" in collector.SPAMHAUS_ZEN_CODES["127.0.0.10"]

    def test_spamhaus_dbl_codes(self):
        """Test Spamhaus DBL return code mappings."""
        collector = DnsblCollector("example.com")

        assert "127.0.1.2" in collector.SPAMHAUS_DBL_CODES
        assert "spam" in collector.SPAMHAUS_DBL_CODES["127.0.1.2"]
        assert "127.0.1.4" in collector.SPAMHAUS_DBL_CODES
        assert "phishing" in collector.SPAMHAUS_DBL_CODES["127.0.1.4"]
        assert "127.0.1.5" in collector.SPAMHAUS_DBL_CODES
        assert "malware" in collector.SPAMHAUS_DBL_CODES["127.0.1.5"]

    def test_ip_dnsbl_list(self):
        """Test IP DNSBL list includes major blocklists."""
        collector = DnsblCollector("example.com")

        zones = [zone for zone, _ in collector.IP_DNSBLS]
        assert "zen.spamhaus.org" in zones
        assert "b.barracudacentral.org" in zones
        assert "bl.spamcop.net" in zones

    def test_domain_dnsbl_list(self):
        """Test domain DNSBL list includes major blocklists."""
        collector = DnsblCollector("example.com")

        zones = [zone for zone, _ in collector.DOMAIN_DNSBLS]
        assert "dbl.spamhaus.org" in zones
        assert "multi.surbl.org" in zones
