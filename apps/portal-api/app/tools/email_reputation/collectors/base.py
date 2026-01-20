"""Base collector class for email reputation analysis."""

import asyncio
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.core.logging import logger


@dataclass
class CollectorResult[T]:
    """Result from a collector."""

    data: T | None = None
    error: str | None = None
    timed_out: bool = False
    duration_ms: float = 0.0


class BaseCollector[T](ABC):
    """
    Base class for all email reputation collectors.

    Provides common functionality for timeout handling,
    error capture, and logging.
    """

    name: str = "base"
    default_timeout: float = 5.0

    def __init__(self, domain: str, timeout: float | None = None, **kwargs):
        """
        Initialize the collector.

        Args:
            domain: The domain to analyze.
            timeout: Timeout in seconds. Defaults to class default.
            **kwargs: Additional collector-specific arguments.
        """
        self.domain = domain
        self.timeout = timeout or self.default_timeout

    @abstractmethod
    async def collect(self) -> T:
        """
        Perform the collection.

        This method should be implemented by subclasses.
        It should return the collected data or raise an exception on failure.
        """
        pass

    async def run(self) -> CollectorResult[T]:
        """
        Run the collector with timeout and error handling.

        Returns:
            CollectorResult containing the data or error information.
        """
        start = time.monotonic()
        result = CollectorResult[T]()

        try:
            data = await asyncio.wait_for(self.collect(), timeout=self.timeout)
            result.data = data
        except TimeoutError:
            result.timed_out = True
            result.error = f"{self.name} collector timed out after {self.timeout}s"
            logger.warning(f"{self.name} collector timed out for {self.domain}")
        except Exception as e:
            result.error = str(e)
            logger.error(f"{self.name} collector error for {self.domain}: {e}")

        result.duration_ms = (time.monotonic() - start) * 1000
        return result
