"""Risk scoring and flag aggregation."""

from app.tools.domain_interrogator.collectors.base import BaseCollector
from app.tools.domain_interrogator.models import (
    DnsInfo,
    DnssecInfo,
    MailInfo,
    RiskFlag,
    RiskInfo,
    RiskSeverity,
    WebInfo,
)


class RiskCollector(BaseCollector[RiskInfo]):
    """Aggregates risk flags and calculates risk score."""

    name = "risk"
    default_timeout = 1.0  # This is mostly computation, not I/O

    def __init__(
        self,
        domain: str,
        dns_info: DnsInfo | None = None,
        dnssec_info: DnssecInfo | None = None,
        mail_info: MailInfo | None = None,
        web_info: WebInfo | None = None,
        timeout: float | None = None,
    ):
        """Initialize with collected data from other collectors."""
        super().__init__(domain, timeout)
        self.dns_info = dns_info
        self.dnssec_info = dnssec_info
        self.mail_info = mail_info
        self.web_info = web_info

    async def collect(self) -> RiskInfo:
        """Calculate risk score and gather flags."""
        info = RiskInfo()
        flags: list[RiskFlag] = []

        # Start with perfect score
        score = 100

        # Check TLS/Certificate issues
        if self.web_info:
            cert_flags, cert_deductions = self._check_certificate_risks()
            flags.extend(cert_flags)
            score -= cert_deductions

            # Check HTTPS availability
            if not self.web_info.https_reachable:
                flags.append(
                    RiskFlag(
                        severity=RiskSeverity.MEDIUM,
                        category="Web",
                        message="HTTPS not reachable",
                        points_deducted=10,
                    )
                )
                score -= 10

            # Check HSTS
            if self.web_info.https_reachable and not self.web_info.hsts_enabled:
                flags.append(
                    RiskFlag(
                        severity=RiskSeverity.LOW,
                        category="Web",
                        message="HSTS not enabled",
                        points_deducted=5,
                    )
                )
                score -= 5

        # Check DNSSEC issues
        if self.dnssec_info:
            dnssec_flags, dnssec_deductions = self._check_dnssec_risks()
            flags.extend(dnssec_flags)
            score -= dnssec_deductions

        # Check DNS delegation issues
        if self.dns_info and self.dns_info.delegation and self.dns_info.delegation.is_lame:
            lame_count = len(self.dns_info.delegation.lame_ns)
            flags.append(
                RiskFlag(
                    severity=RiskSeverity.HIGH,
                    category="DNS",
                    message=f"Lame delegation detected ({lame_count} NS servers)",
                    points_deducted=20,
                )
            )
            score -= 20

        # Check email security
        if self.mail_info:
            mail_flags, mail_deductions = self._check_mail_risks()
            flags.extend(mail_flags)
            score -= mail_deductions

        # Ensure score doesn't go below 0
        score = max(0, score)

        info.score = score
        info.grade = self._score_to_grade(score)
        info.flags = flags

        return info

    def _check_certificate_risks(self) -> tuple[list[RiskFlag], int]:
        """Check for certificate-related risks."""
        flags = []
        deductions = 0

        if not self.web_info or not self.web_info.tls_cert:
            return flags, deductions

        cert = self.web_info.tls_cert

        # Expired certificate (Critical)
        if cert.is_expired:
            flags.append(
                RiskFlag(
                    severity=RiskSeverity.CRITICAL,
                    category="TLS",
                    message="TLS certificate is expired",
                    points_deducted=40,
                )
            )
            deductions += 40

        # Certificate expiring very soon (High)
        elif cert.days_until_expiry <= 7:
            flags.append(
                RiskFlag(
                    severity=RiskSeverity.HIGH,
                    category="TLS",
                    message=f"TLS certificate expires in {cert.days_until_expiry} days",
                    points_deducted=25,
                )
            )
            deductions += 25

        # Certificate expiring soon (Medium)
        elif cert.days_until_expiry <= 30:
            flags.append(
                RiskFlag(
                    severity=RiskSeverity.MEDIUM,
                    category="TLS",
                    message=f"TLS certificate expires in {cert.days_until_expiry} days",
                    points_deducted=10,
                )
            )
            deductions += 10

        return flags, deductions

    def _check_dnssec_risks(self) -> tuple[list[RiskFlag], int]:
        """Check for DNSSEC-related risks."""
        flags = []
        deductions = 0

        if not self.dnssec_info:
            return flags, deductions

        # DNSSEC enabled but not valid (High)
        if self.dnssec_info.enabled and not self.dnssec_info.valid:
            flags.append(
                RiskFlag(
                    severity=RiskSeverity.HIGH,
                    category="DNSSEC",
                    message="DNSSEC is enabled but validation failed",
                    points_deducted=20,
                )
            )
            deductions += 20

        # DNSSEC not enabled (Info - not necessarily a risk)
        elif not self.dnssec_info.enabled:
            flags.append(
                RiskFlag(
                    severity=RiskSeverity.INFO,
                    category="DNSSEC",
                    message="DNSSEC is not enabled",
                    points_deducted=0,
                )
            )

        return flags, deductions

    def _check_mail_risks(self) -> tuple[list[RiskFlag], int]:
        """Check for email security risks."""
        flags = []
        deductions = 0

        if not self.mail_info:
            return flags, deductions

        # No MX records (Low - domain may not use email)
        if not self.mail_info.mx_records:
            flags.append(
                RiskFlag(
                    severity=RiskSeverity.LOW,
                    category="Email",
                    message="No MX records found",
                    points_deducted=5,
                )
            )
            deductions += 5
            return flags, deductions  # No point checking SPF/DMARC if no MX

        # Check SPF
        if self.mail_info.spf:
            spf = self.mail_info.spf
            if not spf.exists:
                flags.append(
                    RiskFlag(
                        severity=RiskSeverity.MEDIUM,
                        category="Email",
                        message="No SPF record found",
                        points_deducted=10,
                    )
                )
                deductions += 10
            elif spf.all_mechanism == "+all":
                flags.append(
                    RiskFlag(
                        severity=RiskSeverity.HIGH,
                        category="Email",
                        message="SPF uses +all (permits all senders)",
                        points_deducted=20,
                    )
                )
                deductions += 20
            elif spf.lookup_count > 10:
                flags.append(
                    RiskFlag(
                        severity=RiskSeverity.MEDIUM,
                        category="Email",
                        message=f"SPF exceeds 10-lookup limit ({spf.lookup_count})",
                        points_deducted=10,
                    )
                )
                deductions += 10

        # Check DMARC
        if self.mail_info.dmarc:
            dmarc = self.mail_info.dmarc
            if not dmarc.exists:
                flags.append(
                    RiskFlag(
                        severity=RiskSeverity.MEDIUM,
                        category="Email",
                        message="No DMARC record found",
                        points_deducted=10,
                    )
                )
                deductions += 10
            elif dmarc.policy == "none":
                flags.append(
                    RiskFlag(
                        severity=RiskSeverity.LOW,
                        category="Email",
                        message="DMARC policy is 'none' (monitoring only)",
                        points_deducted=5,
                    )
                )
                deductions += 5

        return flags, deductions

    def _score_to_grade(self, score: int) -> str:
        """Convert numeric score to letter grade."""
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"
