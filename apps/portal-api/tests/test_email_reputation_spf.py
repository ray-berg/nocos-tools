"""Tests for SPF collector."""

import pytest

from app.tools.email_reputation.collectors.spf import SpfCollector
from app.tools.email_reputation.models import SpfStatus


class TestSpfCollector:
    """Tests for SpfCollector class."""

    def test_parse_mechanisms(self):
        """Test mechanism parsing."""
        collector = SpfCollector("example.com")

        record = "v=spf1 include:_spf.google.com ip4:1.2.3.4 mx -all"
        mechanisms = collector._parse_mechanisms(record)

        assert "include:_spf.google.com" in mechanisms
        assert "ip4:1.2.3.4" in mechanisms
        assert "mx" in mechanisms
        assert "-all" in mechanisms

    def test_count_lookups(self):
        """Test lookup counting for various mechanisms."""
        collector = SpfCollector("example.com")

        # These require lookups: include, a, mx, ptr, exists, redirect
        record = "v=spf1 include:a.com a mx ptr exists:%{i}.bl.example.com redirect=b.com"
        count = collector._count_lookups(record)
        assert count == 5  # include, a, mx, ptr, exists

        # These don't require lookups: ip4, ip6, all
        record2 = "v=spf1 ip4:1.2.3.4 ip6:2001:db8::1 -all"
        count2 = collector._count_lookups(record2)
        assert count2 == 0

    def test_get_all_mechanism(self):
        """Test extracting all mechanism."""
        collector = SpfCollector("example.com")

        assert collector._get_all_mechanism("v=spf1 -all") == "-all"
        assert collector._get_all_mechanism("v=spf1 ~all") == "~all"
        assert collector._get_all_mechanism("v=spf1 +all") == "+all"
        assert collector._get_all_mechanism("v=spf1 ?all") == "?all"
        assert collector._get_all_mechanism("v=spf1 all") == "+all"  # Default is +
        assert collector._get_all_mechanism("v=spf1 include:a.com") is None

    def test_has_redirect(self):
        """Test redirect detection."""
        collector = SpfCollector("example.com")

        assert collector._has_redirect("v=spf1 redirect=other.com") is True
        assert collector._has_redirect("v=spf1 include:a.com -all") is False
