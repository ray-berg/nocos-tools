"""Tests for domain interrogator cache."""

from app.tools.domain_interrogator.cache import DomainCache


class TestDomainCache:
    """Tests for DomainCache class."""

    def test_set_and_get(self):
        """Test basic set and get operations."""
        cache = DomainCache(maxsize=100, ttl=600)
        domain = "example.com"
        options = {"include_web": True, "include_ct": True, "include_dnssec": True}
        result = {"domain": domain, "data": "test"}

        cache.set(domain, options, result)
        cached = cache.get(domain, options)

        assert cached == result

    def test_get_nonexistent(self):
        """Test getting non-existent key returns None."""
        cache = DomainCache(maxsize=100, ttl=600)
        domain = "example.com"
        options = {"include_web": True}

        cached = cache.get(domain, options)
        assert cached is None

    def test_different_options_different_keys(self):
        """Test that different options create different cache keys."""
        cache = DomainCache(maxsize=100, ttl=600)
        domain = "example.com"
        options1 = {"include_web": True, "include_ct": True, "include_dnssec": True}
        options2 = {"include_web": False, "include_ct": True, "include_dnssec": True}
        result1 = {"domain": domain, "data": "test1"}
        result2 = {"domain": domain, "data": "test2"}

        cache.set(domain, options1, result1)
        cache.set(domain, options2, result2)

        assert cache.get(domain, options1) == result1
        assert cache.get(domain, options2) == result2

    def test_case_insensitive_domain(self):
        """Test that domain caching is case-insensitive."""
        cache = DomainCache(maxsize=100, ttl=600)
        options = {"include_web": True}
        result = {"data": "test"}

        cache.set("EXAMPLE.COM", options, result)
        cached = cache.get("example.com", options)

        assert cached == result

    def test_clear(self):
        """Test clearing the cache."""
        cache = DomainCache(maxsize=100, ttl=600)
        domain = "example.com"
        options = {"include_web": True}
        result = {"data": "test"}

        cache.set(domain, options, result)
        assert cache.get(domain, options) is not None

        cache.clear()
        assert cache.get(domain, options) is None

    def test_len(self):
        """Test cache length."""
        cache = DomainCache(maxsize=100, ttl=600)

        assert len(cache) == 0

        cache.set("example1.com", {"include_web": True}, {"data": "1"})
        assert len(cache) == 1

        cache.set("example2.com", {"include_web": True}, {"data": "2"})
        assert len(cache) == 2

    def test_ttl_property(self):
        """Test TTL property."""
        cache = DomainCache(maxsize=100, ttl=300)
        assert cache.ttl == 300

    def test_maxsize(self):
        """Test cache respects maxsize."""
        cache = DomainCache(maxsize=2, ttl=600)
        options = {"include_web": True}

        cache.set("example1.com", options, {"data": "1"})
        cache.set("example2.com", options, {"data": "2"})
        cache.set("example3.com", options, {"data": "3"})

        # Cache should have evicted oldest entry
        assert len(cache) == 2
        # Most recent entries should still be present
        assert cache.get("example3.com", options) is not None
