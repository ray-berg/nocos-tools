"""Web and TLS collector."""

import contextlib
import socket
import ssl
from datetime import UTC, datetime

import httpx

from app.core.settings import settings
from app.tools.domain_interrogator.collectors.base import BaseCollector
from app.tools.domain_interrogator.models import TlsCertInfo, WebInfo


class WebCollector(BaseCollector[WebInfo]):
    """Collects HTTP/HTTPS reachability and TLS certificate information."""

    name = "web"
    default_timeout = 5.0

    async def collect(self) -> WebInfo:
        """Collect web and TLS information."""
        info = WebInfo()

        timeout = settings.domain_intel_http_timeout_s

        # Check HTTP reachability
        http_result = await self._check_http(timeout)
        info.http_reachable = http_result.get("reachable", False)
        info.http_status = http_result.get("status")
        info.http_redirects_to_https = http_result.get("redirects_to_https", False)

        # Check HTTPS reachability
        https_result = await self._check_https(timeout)
        info.https_reachable = https_result.get("reachable", False)
        info.https_status = https_result.get("status")
        info.hsts_enabled = https_result.get("hsts_enabled", False)
        info.hsts_max_age = https_result.get("hsts_max_age")
        info.server_header = https_result.get("server")

        # Get TLS certificate info
        cert_info = await self._get_tls_cert_info()
        if cert_info:
            info.tls_cert = cert_info
            info.tls_version = await self._get_tls_version()

        return info

    async def _check_http(self, timeout: float) -> dict:
        """Check HTTP reachability."""
        result = {"reachable": False, "redirects_to_https": False}
        try:
            async with httpx.AsyncClient(
                timeout=timeout,
                follow_redirects=False,
                verify=False,
            ) as client:
                response = await client.get(f"http://{self.domain}/")
                result["reachable"] = True
                result["status"] = response.status_code

                # Check if redirects to HTTPS
                if response.status_code in (301, 302, 307, 308):
                    location = response.headers.get("location", "")
                    if location.startswith("https://"):
                        result["redirects_to_https"] = True
        except Exception:
            pass
        return result

    async def _check_https(self, timeout: float) -> dict:
        """Check HTTPS reachability and HSTS."""
        result = {"reachable": False}
        try:
            async with httpx.AsyncClient(
                timeout=timeout,
                follow_redirects=True,
                verify=True,
            ) as client:
                response = await client.get(f"https://{self.domain}/")
                result["reachable"] = True
                result["status"] = response.status_code
                result["server"] = response.headers.get("server")

                # Check HSTS header
                hsts = response.headers.get("strict-transport-security")
                if hsts:
                    result["hsts_enabled"] = True
                    # Parse max-age
                    for part in hsts.split(";"):
                        part = part.strip().lower()
                        if part.startswith("max-age="):
                            with contextlib.suppress(ValueError, IndexError):
                                result["hsts_max_age"] = int(part.split("=")[1])
        except Exception:
            pass
        return result

    async def _get_tls_cert_info(self) -> TlsCertInfo | None:
        """Get TLS certificate information."""
        try:
            # Create SSL context
            context = ssl.create_default_context()

            # Connect and get certificate
            with (
                socket.create_connection((self.domain, 443), timeout=3.0) as sock,
                context.wrap_socket(sock, server_hostname=self.domain) as ssock,
            ):
                cert = ssock.getpeercert()
                if not cert:
                    return None

                # Parse certificate
                subject = self._format_cert_name(cert.get("subject", ()))
                issuer = self._format_cert_name(cert.get("issuer", ()))

                # Parse dates
                not_before = cert.get("notBefore", "")
                not_after = cert.get("notAfter", "")

                # Parse dates to calculate expiry
                not_after_dt = self._parse_cert_date(not_after)
                now = datetime.now(UTC)

                days_until_expiry = 0
                is_expired = False
                is_expiring_soon = False

                if not_after_dt:
                    delta = not_after_dt - now
                    days_until_expiry = delta.days
                    is_expired = days_until_expiry < 0
                    is_expiring_soon = 0 <= days_until_expiry <= 30

                # Get SAN domains
                san_domains = []
                for san_type, san_value in cert.get("subjectAltName", ()):
                    if san_type == "DNS":
                        san_domains.append(san_value)

                # Get serial number
                serial = cert.get("serialNumber", "")

                return TlsCertInfo(
                    subject=subject,
                    issuer=issuer,
                    serial_number=serial,
                    not_before=not_before,
                    not_after=not_after,
                    days_until_expiry=days_until_expiry,
                    san_domains=san_domains,
                    is_expired=is_expired,
                    is_expiring_soon=is_expiring_soon,
                )
        except Exception:
            return None

    def _format_cert_name(self, name_tuple: tuple) -> str:
        """Format certificate subject/issuer name."""
        parts = []
        for rdn in name_tuple:
            for attr_type, attr_value in rdn:
                parts.append(f"{attr_type}={attr_value}")
        return ", ".join(parts)

    def _parse_cert_date(self, date_str: str) -> datetime | None:
        """Parse certificate date string."""
        if not date_str:
            return None
        try:
            # Format: 'Jan  1 00:00:00 2024 GMT'
            return datetime.strptime(date_str, "%b %d %H:%M:%S %Y %Z").replace(
                tzinfo=UTC
            )
        except ValueError:
            return None

    async def _get_tls_version(self) -> str | None:
        """Get the TLS version used for the connection."""
        try:
            context = ssl.create_default_context()
            with (
                socket.create_connection((self.domain, 443), timeout=3.0) as sock,
                context.wrap_socket(sock, server_hostname=self.domain) as ssock,
            ):
                return ssock.version()
        except Exception:
            return None
