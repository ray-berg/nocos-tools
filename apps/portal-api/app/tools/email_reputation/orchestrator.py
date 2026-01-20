"""Orchestrator for email reputation analysis."""

import asyncio
from datetime import UTC, datetime

from app.core.logging import logger
from app.tools.email_reputation.cache import email_reputation_cache
from app.tools.email_reputation.collectors import (
    BehavioralCollector,
    DkimCollector,
    DmarcCollector,
    DnsblCollector,
    MxInferenceCollector,
    PtrCollector,
    RiskCollector,
    SmtpTlsCollector,
    SpfCollector,
)
from app.tools.email_reputation.models import (
    AuthPosture,
    EmailReputationReport,
    InfrastructureTrust,
    RunRequest,
)


class EmailReputationOrchestrator:
    """Orchestrates the email reputation analysis process."""

    MAX_CONCURRENCY = 8
    TOTAL_TIMEOUT = 15.0

    def __init__(self, request: RunRequest):
        """
        Initialize the orchestrator.

        Args:
            request: The analysis request.
        """
        self.request = request
        self.domain = request.domain
        self.sending_ip = request.sending_ip
        self.semaphore = asyncio.Semaphore(self.MAX_CONCURRENCY)

    async def run(self) -> EmailReputationReport:
        """
        Run the email reputation analysis.

        Returns:
            Complete EmailReputationReport.
        """
        # Build options dict for cache key
        options = {
            "sending_ip": self.sending_ip,
            "from_address": self.request.from_address,
            "helo_hostname": self.request.helo_hostname,
            "assume_provider": (
                self.request.assume_provider.value
                if self.request.assume_provider
                else None
            ),
        }

        # Check cache
        cached = email_reputation_cache.get(self.domain, options)
        if cached:
            logger.info(f"Cache hit for email reputation: {self.domain}")
            report = EmailReputationReport(**cached)
            report.cached = True
            return report

        # Run analysis
        report = await self._run_analysis()

        # Cache result
        email_reputation_cache.set(self.domain, options, report.model_dump(mode="json"))

        return report

    async def _run_analysis(self) -> EmailReputationReport:
        """Run the actual analysis."""
        report = EmailReputationReport(
            domain=self.domain,
            queried_at=datetime.now(UTC),
            cached=False,
            options={
                "sending_ip": self.sending_ip,
                "from_address": self.request.from_address,
                "helo_hostname": self.request.helo_hostname,
            },
        )

        errors: list[str] = []

        # Phase 1: Run authentication and infrastructure collectors concurrently
        try:
            phase1_results = await asyncio.wait_for(
                self._run_phase1(),
                timeout=self.TOTAL_TIMEOUT,
            )

            spf_result, dkim_result, dmarc_result, mx_result = phase1_results

            # Extract data from results
            spf_info = spf_result.data if spf_result and not spf_result.error else None
            dkim_info = dkim_result.data if dkim_result and not dkim_result.error else None
            dmarc_info = dmarc_result.data if dmarc_result and not dmarc_result.error else None
            mx_info = mx_result.data if mx_result and not mx_result.error else None

            # Collect errors
            for result, name in [
                (spf_result, "SPF"),
                (dkim_result, "DKIM"),
                (dmarc_result, "DMARC"),
                (mx_result, "MX inference"),
            ]:
                if result and result.error:
                    errors.append(f"{name}: {result.error}")

        except TimeoutError:
            errors.append("Phase 1 analysis timed out")
            spf_info = dkim_info = dmarc_info = mx_info = None

        # Phase 2: Run IP-dependent collectors (if IP provided)
        ptr_info = None
        dnsbl_info = None
        smtp_tls_info = None
        behavioral_info = None

        try:
            phase2_results = await asyncio.wait_for(
                self._run_phase2(mx_info),
                timeout=self.TOTAL_TIMEOUT - 8,  # Leave time for risk calculation
            )

            ptr_result, dnsbl_result, smtp_tls_result, behavioral_result = phase2_results

            ptr_info = ptr_result.data if ptr_result and not ptr_result.error else None
            dnsbl_info = dnsbl_result.data if dnsbl_result and not dnsbl_result.error else None
            smtp_tls_info = (
                smtp_tls_result.data if smtp_tls_result and not smtp_tls_result.error else None
            )
            behavioral_info = (
                behavioral_result.data
                if behavioral_result and not behavioral_result.error
                else None
            )

            for result, name in [
                (ptr_result, "PTR"),
                (dnsbl_result, "DNSBL"),
                (smtp_tls_result, "SMTP TLS"),
                (behavioral_result, "Behavioral"),
            ]:
                if result and result.error:
                    errors.append(f"{name}: {result.error}")

        except TimeoutError:
            errors.append("Phase 2 analysis timed out")

        # Phase 3: Risk calculation
        try:
            risk_collector = RiskCollector(
                domain=self.domain,
                spf=spf_info,
                dkim=dkim_info,
                dmarc=dmarc_info,
                ptr=ptr_info,
                dnsbl=dnsbl_info,
                smtp_tls=smtp_tls_info,
                behavioral=behavioral_info,
                mx_inference=mx_info,
            )
            risk_result = await risk_collector.run()
            risk_info = risk_result.data if not risk_result.error else None
            if risk_result.error:
                errors.append(f"Risk: {risk_result.error}")

        except Exception as e:
            errors.append(f"Risk calculation failed: {e}")
            risk_info = None

        # Assemble report
        report.auth = AuthPosture(
            spf=spf_info,
            dkim=dkim_info,
            dmarc=dmarc_info,
        )

        # Check HELO consistency if provided
        helo_consistent = None
        if self.request.helo_hostname and ptr_info and ptr_info.ptr_hostname:
            helo_consistent = (
                self.request.helo_hostname.lower() == ptr_info.ptr_hostname.lower()
            )

        report.infrastructure = InfrastructureTrust(
            ptr=ptr_info,
            helo_consistent=helo_consistent,
            smtp_tls=smtp_tls_info,
        )

        report.reputation = dnsbl_info
        report.provider = mx_info
        report.behavioral = behavioral_info
        report.risk = risk_info
        report.errors = errors

        return report

    async def _run_with_semaphore(self, collector):
        """Run a collector with semaphore control."""
        async with self.semaphore:
            return await collector.run()

    async def _noop(self):
        """Return None as a placeholder coroutine."""
        return None

    async def _run_phase1(self):
        """Run authentication and MX collectors."""
        collectors = [
            SpfCollector(self.domain),
            DkimCollector(self.domain),
            DmarcCollector(self.domain),
            MxInferenceCollector(self.domain),
        ]

        tasks = [self._run_with_semaphore(c) for c in collectors]
        return await asyncio.gather(*tasks, return_exceptions=True)

    async def _run_phase2(self, mx_info):
        """Run infrastructure and reputation collectors."""
        tasks = []

        # PTR collector (only if IP provided)
        if self.sending_ip:
            tasks.append(
                self._run_with_semaphore(PtrCollector(self.domain, self.sending_ip))
            )
        else:
            tasks.append(self._noop())  # Placeholder

        # DNSBL collector
        tasks.append(
            self._run_with_semaphore(DnsblCollector(self.domain, self.sending_ip))
        )

        # SMTP TLS collector
        tasks.append(self._run_with_semaphore(SmtpTlsCollector(self.domain)))

        # Behavioral collector
        tasks.append(self._run_with_semaphore(BehavioralCollector(self.domain)))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle exceptions in results
        processed = []
        for r in results:
            if isinstance(r, Exception):
                processed.append(None)
            else:
                processed.append(r)

        return processed
