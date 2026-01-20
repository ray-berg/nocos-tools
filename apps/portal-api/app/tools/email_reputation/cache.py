"""Cache implementation for Email Reputation Analyzer."""

import hashlib
import json

from cachetools import TTLCache

from app.core.settings import settings


class EmailReputationCache:
    """
    TTL-based cache for email reputation results.

    Uses a hash of domain + options as cache key.
    """

    def __init__(self, maxsize: int = 500, ttl: int | None = None):
        """
        Initialize the cache.

        Args:
            maxsize: Maximum number of entries.
            ttl: Time-to-live in seconds. Defaults to settings value.
        """
        self._ttl = ttl or settings.email_rep_cache_ttl_s
        self._cache: TTLCache = TTLCache(maxsize=maxsize, ttl=self._ttl)

    def _make_key(self, domain: str, options: dict) -> str:
        """Generate a cache key from domain and options."""
        key_data = {
            "domain": domain.lower(),
            "options": dict(sorted(options.items())),
        }
        key_str = json.dumps(key_data, sort_keys=True)
        return hashlib.sha256(key_str.encode()).hexdigest()[:32]

    def get(self, domain: str, options: dict) -> dict | None:
        """
        Retrieve a cached result.

        Args:
            domain: The domain that was analyzed.
            options: The options used for analysis.

        Returns:
            Cached result dict or None if not found.
        """
        key = self._make_key(domain, options)
        return self._cache.get(key)

    def set(self, domain: str, options: dict, result: dict) -> None:
        """
        Cache a result.

        Args:
            domain: The domain that was analyzed.
            options: The options used for analysis.
            result: The analysis result to cache.
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
email_reputation_cache = EmailReputationCache()
