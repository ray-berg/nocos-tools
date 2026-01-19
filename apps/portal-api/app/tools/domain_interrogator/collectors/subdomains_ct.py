"""Certificate Transparency subdomains collector."""

import httpx

from app.core.settings import settings
from app.tools.domain_interrogator.collectors.base import BaseCollector
from app.tools.domain_interrogator.models import SubdomainInfo


class SubdomainsCtCollector(BaseCollector[SubdomainInfo]):
    """Collects subdomains from Certificate Transparency logs."""

    name = "subdomains_ct"
    default_timeout = 8.0  # crt.sh can be slow

    # crt.sh API endpoint
    CRT_SH_URL = "https://crt.sh/"

    async def collect(self) -> SubdomainInfo:
        """Collect subdomains from CT logs."""
        info = SubdomainInfo()

        try:
            # Query crt.sh for certificates
            params = {
                "q": f"%.{self.domain}",
                "output": "json",
            }

            async with httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=True,
            ) as client:
                response = await client.get(self.CRT_SH_URL, params=params)

                if response.status_code != 200:
                    info.error = f"crt.sh returned status {response.status_code}"
                    return info

                # Handle empty response
                if not response.text.strip():
                    return info

                data = response.json()

                # Extract unique subdomains
                subdomains = set()
                for entry in data:
                    name_value = entry.get("name_value", "")
                    # name_value can contain multiple domains separated by newlines
                    for name in name_value.split("\n"):
                        name = name.strip().lower()
                        if name and self._is_valid_subdomain(name):
                            subdomains.add(name)

                info.total_found = len(subdomains)

                # Sort and limit results
                sorted_subdomains = sorted(subdomains)
                limit = settings.domain_intel_subdomain_limit

                if len(sorted_subdomains) > limit:
                    info.subdomains = sorted_subdomains[:limit]
                    info.truncated = True
                else:
                    info.subdomains = sorted_subdomains

        except httpx.TimeoutException:
            info.error = "crt.sh request timed out"
        except httpx.RequestError as e:
            info.error = f"crt.sh request failed: {str(e)}"
        except Exception as e:
            info.error = f"Failed to parse crt.sh response: {str(e)}"

        return info

    def _is_valid_subdomain(self, name: str) -> bool:
        """Check if a name is a valid subdomain of the target domain."""
        # Must end with the target domain
        if not name.endswith(f".{self.domain}") and name != self.domain:
            return False

        # Skip wildcard entries
        if name.startswith("*."):
            name = name[2:]

        # Basic validation
        if not name:
            return False

        # Check for invalid characters
        return all(char in "abcdefghijklmnopqrstuvwxyz0123456789.-" for char in name)
