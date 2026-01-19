"""Tests for domain interrogator collectors."""

import pytest

from app.tools.domain_interrogator.collectors.base import BaseCollector
from app.tools.domain_interrogator.collectors.risk import RiskCollector
from app.tools.domain_interrogator.models import (
    DelegationInfo,
    DmarcInfo,
    DnsInfo,
    DnssecInfo,
    MailInfo,
    SpfInfo,
    TlsCertInfo,
    WebInfo,
)


class TestBaseCollector:
    """Tests for BaseCollector class."""

    @pytest.mark.asyncio
    async def test_timeout_handling(self):
        """Test that collector handles timeout properly."""
        import asyncio

        class SlowCollector(BaseCollector[str]):
            name = "slow"
            default_timeout = 0.1

            async def collect(self) -> str:
                await asyncio.sleep(1)  # Sleep longer than timeout
                return "should not reach"

        collector = SlowCollector("example.com")
        result = await collector.run()

        assert result.data is None
        assert result.timed_out is True
        assert "timed out" in result.error

    @pytest.mark.asyncio
    async def test_error_handling(self):
        """Test that collector handles errors properly."""

        class ErrorCollector(BaseCollector[str]):
            name = "error"

            async def collect(self) -> str:
                raise ValueError("Test error")

        collector = ErrorCollector("example.com")
        result = await collector.run()

        assert result.data is None
        assert result.timed_out is False
        assert "Test error" in result.error

    @pytest.mark.asyncio
    async def test_successful_collection(self):
        """Test successful collection."""

        class SuccessCollector(BaseCollector[str]):
            name = "success"

            async def collect(self) -> str:
                return "test data"

        collector = SuccessCollector("example.com")
        result = await collector.run()

        assert result.data == "test data"
        assert result.error is None
        assert result.timed_out is False
        assert result.duration_ms > 0


class TestRiskCollector:
    """Tests for RiskCollector."""

    @pytest.mark.asyncio
    async def test_perfect_score_no_issues(self):
        """Test perfect score when no issues are detected."""
        # Create minimal valid data with no issues
        dns_info = DnsInfo(records=[], delegation=None)
        dnssec_info = DnssecInfo(enabled=True, valid=True)
        mail_info = MailInfo(
            mx_records=[{"preference": 10, "exchange": "mail.example.com"}],
            spf=SpfInfo(exists=True, is_valid=True, all_mechanism="-all"),
            dmarc=DmarcInfo(exists=True, policy="reject"),
        )
        web_info = WebInfo(
            https_reachable=True,
            hsts_enabled=True,
            tls_cert=TlsCertInfo(
                subject="CN=example.com",
                issuer="CN=Let's Encrypt",
                serial_number="12345",
                not_before="Jan 1 00:00:00 2024 GMT",
                not_after="Jan 1 00:00:00 2025 GMT",
                days_until_expiry=365,
                san_domains=["example.com"],
                is_expired=False,
                is_expiring_soon=False,
            ),
        )

        collector = RiskCollector(
            domain="example.com",
            dns_info=dns_info,
            dnssec_info=dnssec_info,
            mail_info=mail_info,
            web_info=web_info,
        )
        result = await collector.run()

        assert result.data is not None
        assert result.data.score == 100
        assert result.data.grade == "A"

    @pytest.mark.asyncio
    async def test_expired_certificate_critical(self):
        """Test that expired certificate is critical risk."""
        web_info = WebInfo(
            https_reachable=True,
            hsts_enabled=True,
            tls_cert=TlsCertInfo(
                subject="CN=example.com",
                issuer="CN=Let's Encrypt",
                serial_number="12345",
                not_before="Jan 1 00:00:00 2023 GMT",
                not_after="Jan 1 00:00:00 2024 GMT",
                days_until_expiry=-30,
                san_domains=["example.com"],
                is_expired=True,
                is_expiring_soon=False,
            ),
        )

        collector = RiskCollector(domain="example.com", web_info=web_info)
        result = await collector.run()

        assert result.data is not None
        assert result.data.score <= 60  # 40 points deducted for expired cert
        critical_flags = [f for f in result.data.flags if f.severity == "critical"]
        assert len(critical_flags) >= 1
        assert any("expired" in f.message.lower() for f in critical_flags)

    @pytest.mark.asyncio
    async def test_spf_plus_all_high_risk(self):
        """Test that SPF +all is high risk."""
        mail_info = MailInfo(
            mx_records=[{"preference": 10, "exchange": "mail.example.com"}],
            spf=SpfInfo(exists=True, is_valid=True, all_mechanism="+all"),
        )

        collector = RiskCollector(domain="example.com", mail_info=mail_info)
        result = await collector.run()

        assert result.data is not None
        high_flags = [f for f in result.data.flags if f.severity == "high"]
        assert any("+all" in f.message for f in high_flags)

    @pytest.mark.asyncio
    async def test_lame_delegation_high_risk(self):
        """Test that lame delegation is high risk."""
        dns_info = DnsInfo(
            records=[],
            delegation=DelegationInfo(
                nameservers=["ns1.example.com", "ns2.example.com"],
                is_lame=True,
                lame_ns=["ns1.example.com"],
            ),
        )

        collector = RiskCollector(domain="example.com", dns_info=dns_info)
        result = await collector.run()

        assert result.data is not None
        high_flags = [f for f in result.data.flags if f.severity == "high"]
        assert any("lame" in f.message.lower() for f in high_flags)

    @pytest.mark.asyncio
    async def test_no_https_medium_risk(self):
        """Test that no HTTPS is medium risk."""
        web_info = WebInfo(https_reachable=False)

        collector = RiskCollector(domain="example.com", web_info=web_info)
        result = await collector.run()

        assert result.data is not None
        medium_flags = [f for f in result.data.flags if f.severity == "medium"]
        assert any("https" in f.message.lower() for f in medium_flags)

    @pytest.mark.asyncio
    async def test_dmarc_none_low_risk(self):
        """Test that DMARC policy=none is low risk."""
        mail_info = MailInfo(
            mx_records=[{"preference": 10, "exchange": "mail.example.com"}],
            spf=SpfInfo(exists=True),
            dmarc=DmarcInfo(exists=True, policy="none"),
        )

        collector = RiskCollector(domain="example.com", mail_info=mail_info)
        result = await collector.run()

        assert result.data is not None
        low_flags = [f for f in result.data.flags if f.severity == "low"]
        assert any(
            "none" in f.message.lower() or "monitoring" in f.message.lower()
            for f in low_flags
        )

    @pytest.mark.asyncio
    async def test_score_to_grade(self):
        """Test score to grade conversion."""
        collector = RiskCollector(domain="example.com")

        assert collector._score_to_grade(100) == "A"
        assert collector._score_to_grade(90) == "A"
        assert collector._score_to_grade(89) == "B"
        assert collector._score_to_grade(80) == "B"
        assert collector._score_to_grade(79) == "C"
        assert collector._score_to_grade(70) == "C"
        assert collector._score_to_grade(69) == "D"
        assert collector._score_to_grade(60) == "D"
        assert collector._score_to_grade(59) == "F"
        assert collector._score_to_grade(0) == "F"
