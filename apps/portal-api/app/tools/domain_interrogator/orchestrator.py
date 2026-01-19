"""Orchestrator for concurrent collector execution."""

import asyncio
from datetime import UTC, datetime

from app.core.logging import logger
from app.core.settings import settings
from app.tools.domain_interrogator.cache import domain_cache
from app.tools.domain_interrogator.collectors import (
    DnsCollector,
    DnssecCollector,
    IpIntelCollector,
    MailCollector,
    RdapCollector,
    RiskCollector,
    SubdomainsCtCollector,
    WebCollector,
)
from app.tools.domain_interrogator.models import DomainReport, RunRequest


class DomainOrchestrator:
    """Orchestrates concurrent execution of domain collectors."""

    # Maximum concurrent operations
    MAX_CONCURRENCY = 8

    # Total timeout budget
    TOTAL_TIMEOUT = 12.0

    def __init__(self, request: RunRequest):
        """Initialize orchestrator with request."""
        self.domain = request.domain
        self.include_web = request.include_web
        self.include_ct = request.include_ct
        self.include_dnssec = request.include_dnssec
        self.semaphore = asyncio.Semaphore(self.MAX_CONCURRENCY)

    async def run(self) -> DomainReport:
        """Run all collectors and build the domain report."""
        options = {
            "include_web": self.include_web,
            "include_ct": self.include_ct,
            "include_dnssec": self.include_dnssec,
        }

        # Check cache first
        cached = domain_cache.get(self.domain, options)
        if cached:
            logger.info(f"Cache hit for {self.domain}")
            report = DomainReport(**cached)
            report.cached = True
            return report

        logger.info(f"Starting domain interrogation for {self.domain}")

        # Initialize report
        report = DomainReport(
            domain=self.domain,
            queried_at=datetime.now(UTC),
            cached=False,
            options=options,
        )

        errors: list[str] = []

        try:
            # Run collectors with overall timeout
            await asyncio.wait_for(
                self._run_collectors(report, errors),
                timeout=self.TOTAL_TIMEOUT
            )
        except TimeoutError:
            errors.append(f"Overall timeout exceeded ({self.TOTAL_TIMEOUT}s)")
            logger.warning(f"Overall timeout for {self.domain}")

        report.errors = errors

        # Cache the result
        domain_cache.set(self.domain, options, report.model_dump(mode="json"))

        return report

    async def _run_collectors(self, report: DomainReport, errors: list[str]) -> None:
        """Run collectors concurrently with semaphore control."""
        # Phase 1: Run DNS and RDAP first (needed for other collectors)
        phase1_tasks = [
            self._run_with_semaphore(DnsCollector(self.domain)),
            self._run_with_semaphore(RdapCollector(self.domain)),
        ]

        phase1_results = await asyncio.gather(*phase1_tasks, return_exceptions=True)

        # Process DNS result
        dns_result = phase1_results[0]
        if isinstance(dns_result, Exception):
            errors.append(f"DNS collector error: {str(dns_result)}")
        elif dns_result.error:
            errors.append(f"DNS: {dns_result.error}")
        if not isinstance(dns_result, Exception):
            report.dns = dns_result.data

        # Process RDAP result
        rdap_result = phase1_results[1]
        if isinstance(rdap_result, Exception):
            errors.append(f"RDAP collector error: {str(rdap_result)}")
        elif rdap_result.error:
            errors.append(f"RDAP: {rdap_result.error}")
        if not isinstance(rdap_result, Exception):
            report.rdap = rdap_result.data

        # Phase 2: Run remaining collectors in parallel
        phase2_tasks = []

        # Always run mail collector
        phase2_tasks.append(("mail", self._run_with_semaphore(MailCollector(self.domain))))

        # Always run IP intel
        phase2_tasks.append(("ipintel", self._run_with_semaphore(IpIntelCollector(self.domain))))

        # Optional collectors
        if self.include_web and settings.domain_intel_web_fetch:
            task = self._run_with_semaphore(WebCollector(self.domain))
            phase2_tasks.append(("web", task))

        if self.include_dnssec and settings.domain_intel_dnssec_check:
            task = self._run_with_semaphore(DnssecCollector(self.domain))
            phase2_tasks.append(("dnssec", task))

        if self.include_ct:
            task = self._run_with_semaphore(SubdomainsCtCollector(self.domain))
            phase2_tasks.append(("ct", task))

        # Execute phase 2
        task_names = [t[0] for t in phase2_tasks]
        task_coros = [t[1] for t in phase2_tasks]
        phase2_results = await asyncio.gather(*task_coros, return_exceptions=True)

        # Process results
        for name, result in zip(task_names, phase2_results, strict=False):
            if isinstance(result, Exception):
                errors.append(f"{name} collector error: {str(result)}")
                continue

            if result.error:
                errors.append(f"{name}: {result.error}")

            if name == "mail":
                report.mail = result.data
            elif name == "ipintel":
                report.ip_intel = result.data
            elif name == "web":
                report.web = result.data
            elif name == "dnssec":
                report.dnssec = result.data
            elif name == "ct":
                report.subdomains = result.data

        # Phase 3: Calculate risk score (depends on other results)
        risk_collector = RiskCollector(
            domain=self.domain,
            dns_info=report.dns,
            dnssec_info=report.dnssec,
            mail_info=report.mail,
            web_info=report.web,
        )

        risk_result = await risk_collector.run()
        if risk_result.error:
            errors.append(f"Risk calculation: {risk_result.error}")
        report.risk = risk_result.data

    async def _run_with_semaphore(self, collector):
        """Run a collector with semaphore control."""
        async with self.semaphore:
            return await collector.run()
