"""TTL cache for domain interrogation results."""

import hashlib
import json
from typing import Any

from cachetools import TTLCache

from app.core.settings import settings


class DomainCache:
    """
    TTL cache for domain interrogation results.

    Keys are generated from (domain, options) tuples.
    """

    def __init__(self, maxsize: int = 1000, ttl: int | None = None):
        """
        Initialize the cache.

        Args:
            maxsize: Maximum number of entries to cache.
            ttl: Time-to-live in seconds. Defaults to settings value.
        """
        self._ttl = ttl or settings.domain_intel_cache_ttl_s
        self._cache: TTLCache[str, dict[str, Any]] = TTLCache(
            maxsize=maxsize,
            ttl=self._ttl
        )

    def _make_key(self, domain: str, options: dict[str, bool]) -> str:
        """Generate a cache key from domain and options."""
        key_data = {
            "domain": domain.lower(),
            "options": dict(sorted(options.items()))
        }
        key_json = json.dumps(key_data, sort_keys=True)
        return hashlib.sha256(key_json.encode()).hexdigest()[:32]

    def get(self, domain: str, options: dict[str, bool]) -> dict[str, Any] | None:
        """
        Get a cached result.

        Args:
            domain: The domain that was queried.
            options: The options used for the query.

        Returns:
            The cached result dict or None if not found.
        """
        key = self._make_key(domain, options)
        return self._cache.get(key)

    def set(self, domain: str, options: dict[str, bool], result: dict[str, Any]) -> None:
        """
        Cache a result.

        Args:
            domain: The domain that was queried.
            options: The options used for the query.
            result: The result to cache.
        """
        key = self._make_key(domain, options)
        self._cache[key] = result

    def clear(self) -> None:
        """Clear all cached entries."""
        self._cache.clear()

    @property
    def ttl(self) -> int:
        """Return the TTL in seconds."""
        return self._ttl

    def __len__(self) -> int:
        """Return the number of cached entries."""
        return len(self._cache)


# Global cache instance
domain_cache = DomainCache()
