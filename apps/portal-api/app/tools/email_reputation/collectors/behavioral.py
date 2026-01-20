"""Behavioral collector for email reputation analysis."""

from datetime import UTC, datetime

import httpx

from app.tools.email_reputation.collectors.base import BaseCollector
from app.tools.email_reputation.models import BehavioralInfo, BehavioralRisk


class BehavioralCollector(BaseCollector[BehavioralInfo]):
    """Collector for behavioral indicators like domain age."""

    name = "behavioral"
    default_timeout = 8.0

    RDAP_URL = "https://rdap.org/domain/{domain}"

    async def collect(self) -> BehavioralInfo:
        """Collect behavioral indicators."""
        info = BehavioralInfo()
        issues: list[str] = []

        # Check domain age via RDAP
        domain_age = await self._get_domain_age()

        if domain_age is not None:
            info.domain_age_days = domain_age

            if domain_age < 30:
                info.is_new_domain = True
                info.risk = BehavioralRisk.ELEVATED
                issues.append(f"Domain is very new ({domain_age} days old)")
            elif domain_age < 90:
                info.is_new_domain = True
                info.risk = BehavioralRisk.MEDIUM
                issues.append(f"Domain is relatively new ({domain_age} days old)")
            else:
                info.risk = BehavioralRisk.LOW
        else:
            # Could not determine age
            info.risk = BehavioralRisk.LOW
            issues.append("Could not determine domain age via RDAP")

        info.issues = issues
        return info

    async def _get_domain_age(self) -> int | None:
        """Get domain age in days from RDAP."""
        try:
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                url = self.RDAP_URL.format(domain=self.domain)
                response = await client.get(url)

                if response.status_code == 404:
                    return None
                if response.status_code != 200:
                    return None

                data = response.json()

                # Look for registration event
                events = data.get("events", [])
                for event in events:
                    if event.get("eventAction") == "registration":
                        date_str = event.get("eventDate")
                        if date_str:
                            return self._calculate_age(date_str)

                return None

        except Exception:
            return None

    def _calculate_age(self, date_str: str) -> int | None:
        """Calculate age in days from ISO date string."""
        try:
            # Handle various ISO 8601 formats
            date_str = date_str.replace("Z", "+00:00")

            # Try parsing with timezone
            if "+" in date_str or "-" in date_str[10:]:
                creation_date = datetime.fromisoformat(date_str)
            else:
                # No timezone, assume UTC
                creation_date = datetime.fromisoformat(date_str).replace(
                    tzinfo=UTC
                )

            now = datetime.now(UTC)
            delta = now - creation_date
            return delta.days

        except Exception:
            return None
