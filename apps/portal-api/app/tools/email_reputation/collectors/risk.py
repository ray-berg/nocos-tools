"""Risk collector for email reputation analysis."""

from app.tools.email_reputation.collectors.base import BaseCollector
from app.tools.email_reputation.models import (
    BehavioralInfo,
    BehavioralRisk,
    DkimInfo,
    DkimStatus,
    DmarcInfo,
    DmarcStatus,
    DnsblInfo,
    MxInferenceInfo,
    PtrInfo,
    PtrStatus,
    RiskInfo,
    RiskLevel,
    SmtpTlsInfo,
    SmtpTlsStatus,
    SpfInfo,
    SpfStatus,
)


class RiskCollector(BaseCollector[RiskInfo]):
    """Collector for aggregating all signals into risk assessment."""

    name = "risk"
    default_timeout = 1.0  # Pure computation, no I/O

    def __init__(
        self,
        domain: str,
        spf: SpfInfo | None = None,
        dkim: DkimInfo | None = None,
        dmarc: DmarcInfo | None = None,
        ptr: PtrInfo | None = None,
        dnsbl: DnsblInfo | None = None,
        smtp_tls: SmtpTlsInfo | None = None,
        behavioral: BehavioralInfo | None = None,
        mx_inference: MxInferenceInfo | None = None,
        timeout: float | None = None,
    ):
        """
        Initialize risk collector with collected data.

        Args:
            domain: The domain analyzed.
            spf: SPF analysis results.
            dkim: DKIM analysis results.
            dmarc: DMARC analysis results.
            ptr: PTR analysis results.
            dnsbl: DNSBL check results.
            smtp_tls: SMTP TLS analysis results.
            behavioral: Behavioral analysis results.
            mx_inference: MX inference results.
            timeout: Timeout (not really used here).
        """
        super().__init__(domain, timeout)
        self.spf = spf
        self.dkim = dkim
        self.dmarc = dmarc
        self.ptr = ptr
        self.dnsbl = dnsbl
        self.smtp_tls = smtp_tls
        self.behavioral = behavioral
        self.mx_inference = mx_inference

    async def collect(self) -> RiskInfo:
        """Calculate overall risk assessment."""
        info = RiskInfo()
        score = 0
        failure_modes: list[str] = []
        can_rule_out: list[str] = []
        cannot_determine: list[str] = []

        # === SPF Risk ===
        if self.spf:
            if self.spf.status == SpfStatus.BROKEN:
                score += 30
                failure_modes.append("SPF authentication will fail")
            elif self.spf.status == SpfStatus.FRAGILE:
                score += 15
                failure_modes.append("SPF may fail under certain conditions")

            if self.spf.all_mechanism == "+all":
                score += 10  # Additional penalty
                failure_modes.append("SPF permits any sender")
        else:
            score += 20
            failure_modes.append("SPF not configured")

        # === DKIM Risk ===
        if self.dkim:
            if self.dkim.status == DkimStatus.UNKNOWN:
                score += 10
                # Not a hard failure, just unknown
            # DKIM present is good, no penalty
        else:
            score += 10
            failure_modes.append("DKIM status unknown")

        # === DMARC Risk ===
        if self.dmarc:
            if self.dmarc.status == DmarcStatus.ABSENT:
                score += 10
                failure_modes.append("No DMARC policy")
            elif self.dmarc.status == DmarcStatus.MONITORING:
                score += 5
                # Monitoring is better than nothing

            # DMARC reject with fragile auth is dangerous
            if self.dmarc.status == DmarcStatus.STRICT:
                if self.spf and self.spf.status != SpfStatus.PASSABLE:
                    score += 25
                    failure_modes.append(
                        "DMARC reject policy with unreliable SPF authentication"
                    )
                if self.dkim and self.dkim.status == DkimStatus.UNKNOWN:
                    score += 15
                    failure_modes.append(
                        "DMARC reject policy with unknown DKIM configuration"
                    )
        else:
            score += 10
            failure_modes.append("DMARC not configured")

        # === PTR Risk ===
        if self.ptr:
            if self.ptr.status == PtrStatus.MISSING:
                score += 15
                failure_modes.append("Missing reverse DNS (PTR) record")
            elif self.ptr.status == PtrStatus.EXISTS_MISMATCHED:
                score += 10
                failure_modes.append("PTR hostname does not match forward DNS (FCrDNS)")

        # === DNSBL Risk ===
        if self.dnsbl:
            listing_count = self.dnsbl.total_listings
            if listing_count > 0:
                # Cap at 50 points for DNSBL
                dnsbl_score = min(listing_count * 20, 50)
                score += dnsbl_score
                failure_modes.append(f"Listed on {listing_count} DNS blocklist(s)")
            else:
                can_rule_out.append("IP/domain not on major blocklists")

        # === SMTP TLS Risk ===
        if self.smtp_tls:
            if self.smtp_tls.status == SmtpTlsStatus.ABSENT:
                score += 10
                failure_modes.append("No STARTTLS support on MX")
            elif self.smtp_tls.status == SmtpTlsStatus.DEGRADED:
                score += 5
                failure_modes.append("SMTP TLS certificate issues")

        # === Behavioral Risk ===
        if self.behavioral:
            if self.behavioral.risk == BehavioralRisk.ELEVATED:
                score += 15
                failure_modes.append("Domain is very new (spam indicator)")
            elif self.behavioral.risk == BehavioralRisk.MEDIUM:
                score += 8
                failure_modes.append("Domain is relatively new")

        # === Provider Sensitivity ===
        if self.mx_inference and self.mx_inference.sensitivity:
            sens = self.mx_inference.sensitivity
            # If recipient has strict provider but sender has weak auth
            if sens.dkim_strict and self.dkim and self.dkim.status == DkimStatus.UNKNOWN:
                score += 5
            if sens.dmarc_strict and self.dmarc and self.dmarc.status == DmarcStatus.ABSENT:
                score += 5

        # === Determine Risk Level ===
        if score >= 80:
            info.overall_risk = RiskLevel.CRITICAL
        elif score >= 60:
            info.overall_risk = RiskLevel.HIGH
        elif score >= 40:
            info.overall_risk = RiskLevel.MEDIUM_HIGH
        elif score >= 20:
            info.overall_risk = RiskLevel.MEDIUM
        else:
            info.overall_risk = RiskLevel.LOW

        info.score = score
        info.likely_failure_modes = failure_modes

        # === What we can rule out ===
        if self.spf and self.spf.status == SpfStatus.PASSABLE:
            can_rule_out.append("SPF authentication failures")
        if self.dmarc and self.dmarc.status in (DmarcStatus.STRICT, DmarcStatus.ENFORCING):
            can_rule_out.append("DMARC policy bypass")

        # === What we cannot determine ===
        cannot_determine.append("Temporary provider throttling")
        cannot_determine.append("Recipient-specific policy decisions")
        cannot_determine.append("Content-based filtering")
        cannot_determine.append("Sender reputation history")
        cannot_determine.append("Rate limiting policies")

        info.can_rule_out = can_rule_out
        info.cannot_determine = cannot_determine

        return info
