"""SMTP TLS collector for email reputation analysis."""

import asyncio
import contextlib
import ssl

import dns.asyncresolver
import dns.resolver

from app.core.settings import settings
from app.tools.email_reputation.collectors.base import BaseCollector
from app.tools.email_reputation.models import SmtpTlsInfo, SmtpTlsStatus


class SmtpTlsCollector(BaseCollector[SmtpTlsInfo]):
    """Collector for SMTP STARTTLS capability and certificate analysis."""

    name = "smtp_tls"
    default_timeout = 10.0

    async def collect(self) -> SmtpTlsInfo:
        """Collect and analyze SMTP TLS configuration."""
        info = SmtpTlsInfo()
        issues: list[str] = []

        # First, get MX records
        mx_host = await self._get_primary_mx()
        if not mx_host:
            info.status = SmtpTlsStatus.UNKNOWN
            issues.append("No MX records found - cannot check SMTP TLS")
            info.issues = issues
            return info

        info.mx_host = mx_host

        # Try to connect and check STARTTLS
        try:
            starttls_supported, tls_info = await asyncio.wait_for(
                self._check_starttls(mx_host),
                timeout=settings.email_rep_smtp_timeout_s,
            )

            info.starttls_supported = starttls_supported

            if starttls_supported:
                info.certificate_valid = tls_info.get("cert_valid", False)
                info.certificate_hostname_match = tls_info.get("hostname_match", False)
                info.tls_version = tls_info.get("tls_version")

                if info.certificate_valid and info.certificate_hostname_match:
                    info.status = SmtpTlsStatus.MODERN
                elif info.certificate_valid:
                    info.status = SmtpTlsStatus.DEGRADED
                    issues.append("SMTP certificate hostname mismatch")
                else:
                    info.status = SmtpTlsStatus.DEGRADED
                    issues.append("SMTP certificate validation failed")
            else:
                info.status = SmtpTlsStatus.ABSENT
                issues.append("STARTTLS not supported on primary MX")

        except TimeoutError:
            info.status = SmtpTlsStatus.UNKNOWN
            issues.append("SMTP connection timed out")
        except Exception as e:
            info.status = SmtpTlsStatus.UNKNOWN
            issues.append(f"SMTP TLS check failed: {e}")

        info.issues = issues
        return info

    async def _get_primary_mx(self) -> str | None:
        """Get the primary (lowest preference) MX record."""
        resolver = dns.asyncresolver.Resolver()
        resolver.timeout = 2.0
        resolver.lifetime = 3.0

        try:
            answers = await resolver.resolve(self.domain, "MX")
            if not answers:
                return None

            # Sort by preference and get lowest
            mx_records = []
            for rdata in answers:
                mx_records.append((rdata.preference, str(rdata.exchange).rstrip(".")))

            mx_records.sort(key=lambda x: x[0])
            return mx_records[0][1] if mx_records else None

        except Exception:
            return None

    async def _check_starttls(self, mx_host: str) -> tuple[bool, dict]:
        """
        Check STARTTLS support and certificate.

        Returns tuple of (starttls_supported, tls_info_dict).
        """
        tls_info = {}

        try:
            # Open connection to SMTP port
            reader, writer = await asyncio.open_connection(mx_host, 25)

            try:
                # Read greeting
                await asyncio.wait_for(reader.readline(), timeout=5.0)

                # Send EHLO
                writer.write(b"EHLO email-checker.local\r\n")
                await writer.drain()

                # Read EHLO response (multi-line)
                ehlo_response = ""
                while True:
                    line = await asyncio.wait_for(reader.readline(), timeout=5.0)
                    line_str = line.decode("utf-8", errors="ignore")
                    ehlo_response += line_str
                    if line_str[3:4] == " ":  # Last line has space after code
                        break

                # Check for STARTTLS in response
                if "STARTTLS" not in ehlo_response.upper():
                    writer.write(b"QUIT\r\n")
                    await writer.drain()
                    writer.close()
                    await writer.wait_closed()
                    return (False, tls_info)

                # Send STARTTLS
                writer.write(b"STARTTLS\r\n")
                await writer.drain()

                # Read response
                response = await asyncio.wait_for(reader.readline(), timeout=5.0)
                response_str = response.decode("utf-8", errors="ignore")

                if not response_str.startswith("220"):
                    writer.write(b"QUIT\r\n")
                    await writer.drain()
                    writer.close()
                    await writer.wait_closed()
                    return (False, tls_info)

                # Upgrade to TLS
                ssl_context = ssl.create_default_context()
                ssl_context.check_hostname = False  # We'll check manually
                ssl_context.verify_mode = ssl.CERT_OPTIONAL

                # Get the socket and upgrade
                transport = writer.transport
                sock = transport.get_extra_info("socket")

                # Create SSL socket
                ssl_sock = ssl_context.wrap_socket(
                    sock, server_hostname=mx_host, do_handshake_on_connect=False
                )
                ssl_sock.do_handshake()

                # Get certificate info
                cert = ssl_sock.getpeercert()
                tls_info["tls_version"] = ssl_sock.version()

                # Check certificate validity
                if cert:
                    tls_info["cert_valid"] = True

                    # Check hostname match
                    try:
                        ssl.match_hostname(cert, mx_host)
                        tls_info["hostname_match"] = True
                    except ssl.CertificateError:
                        tls_info["hostname_match"] = False
                else:
                    tls_info["cert_valid"] = False
                    tls_info["hostname_match"] = False

                ssl_sock.close()
                return (True, tls_info)

            except Exception:
                writer.close()
                with contextlib.suppress(Exception):
                    await writer.wait_closed()
                raise

        except (ConnectionRefusedError, OSError):
            return (False, {"error": "Connection refused"})
        except Exception as e:
            return (False, {"error": str(e)})
