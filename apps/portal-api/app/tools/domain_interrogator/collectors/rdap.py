"""RDAP (Registration Data Access Protocol) collector."""

from typing import Any

import httpx

from app.core.settings import settings
from app.tools.domain_interrogator.collectors.base import BaseCollector
from app.tools.domain_interrogator.models import RdapContact, RdapInfo


class RdapCollector(BaseCollector[RdapInfo]):
    """Collects RDAP/registration information."""

    name = "rdap"
    default_timeout = 5.0

    # RDAP bootstrap URL
    RDAP_BOOTSTRAP_URL = "https://rdap.org/domain/"

    async def collect(self) -> RdapInfo:
        """Collect RDAP information."""
        info = RdapInfo()

        try:
            url = f"{self.RDAP_BOOTSTRAP_URL}{self.domain}"
            async with httpx.AsyncClient(
                timeout=settings.domain_intel_http_timeout_s,
                follow_redirects=True,
            ) as client:
                response = await client.get(url)

                if response.status_code == 404:
                    info.error = "Domain not found in RDAP"
                    return info

                if response.status_code != 200:
                    info.error = f"RDAP returned status {response.status_code}"
                    return info

                data = response.json()
                info = self._parse_rdap_response(data)

        except httpx.TimeoutException:
            info.error = "RDAP request timed out"
        except httpx.RequestError as e:
            info.error = f"RDAP request failed: {str(e)}"
        except Exception as e:
            info.error = f"RDAP parsing error: {str(e)}"

        return info

    def _parse_rdap_response(self, data: dict[str, Any]) -> RdapInfo:
        """Parse RDAP JSON response."""
        info = RdapInfo()

        # Get status
        info.status = data.get("status", [])

        # Get nameservers
        nameservers = data.get("nameservers", [])
        info.nameservers = [
            ns.get("ldhName", "").rstrip(".")
            for ns in nameservers
            if ns.get("ldhName")
        ]

        # Get events (dates)
        for event in data.get("events", []):
            event_action = event.get("eventAction", "")
            event_date = event.get("eventDate", "")
            if event_action == "registration":
                info.creation_date = event_date
            elif event_action == "expiration":
                info.expiration_date = event_date
            elif event_action == "last changed":
                info.updated_date = event_date

        # Get entities (registrar, registrant)
        for entity in data.get("entities", []):
            roles = entity.get("roles", [])

            if "registrar" in roles:
                # Get registrar name
                vcard = entity.get("vcardArray", [])
                info.registrar = self._extract_vcard_name(vcard)
                if not info.registrar:
                    # Try publicIds
                    for pid in entity.get("publicIds", []):
                        if pid.get("type") == "IANA Registrar ID":
                            info.registrar = f"Registrar ID: {pid.get('identifier')}"
                            break

            if "registrant" in roles:
                info.registrant = self._parse_entity_contact(entity)

        return info

    def _extract_vcard_name(self, vcard_array: list) -> str | None:
        """Extract name from vCard array."""
        if len(vcard_array) < 2:
            return None

        for item in vcard_array[1]:
            if len(item) >= 4 and item[0] == "fn":
                return item[3]
        return None

    def _parse_entity_contact(self, entity: dict[str, Any]) -> RdapContact:
        """Parse entity into contact information."""
        contact = RdapContact()

        vcard = entity.get("vcardArray", [])
        if len(vcard) >= 2:
            for item in vcard[1]:
                if len(item) >= 4:
                    prop_name = item[0]
                    prop_value = item[3]

                    if prop_name == "fn":
                        contact.name = prop_value
                    elif prop_name == "org":
                        if isinstance(prop_value, str):
                            contact.organization = prop_value
                        elif isinstance(prop_value, list) and prop_value:
                            contact.organization = prop_value[0]
                    elif prop_name == "email":
                        contact.email = prop_value

        return contact
