"""MX inference collector for email reputation analysis."""

import re

import dns.asyncresolver
import dns.resolver

from app.tools.email_reputation.collectors.base import BaseCollector
from app.tools.email_reputation.models import (
    InferredProvider,
    MxInferenceInfo,
    ProviderSensitivity,
)


class MxInferenceCollector(BaseCollector[MxInferenceInfo]):
    """Collector for inferring email provider from MX records."""

    name = "mx_inference"
    default_timeout = 5.0

    # MX pattern to provider mapping
    MX_PATTERNS = [
        # Google
        (r"\.google\.com\.?$", InferredProvider.GOOGLE),
        (r"\.googlemail\.com\.?$", InferredProvider.GOOGLE),
        (r"aspmx\.l\.google\.com\.?$", InferredProvider.GOOGLE),
        # Microsoft
        (r"\.outlook\.com\.?$", InferredProvider.MICROSOFT),
        (r"\.protection\.outlook\.com\.?$", InferredProvider.MICROSOFT),
        (r"\.mail\.protection\.outlook\.com\.?$", InferredProvider.MICROSOFT),
        # Proofpoint
        (r"\.pphosted\.com\.?$", InferredProvider.PROOFPOINT),
        (r"\.ppe-hosted\.com\.?$", InferredProvider.PROOFPOINT),
        # Mimecast
        (r"\.mimecast\.com\.?$", InferredProvider.MIMECAST),
        (r"\.mimecast-offshore\.com\.?$", InferredProvider.MIMECAST),
        # Barracuda
        (r"\.barracudanetworks\.com\.?$", InferredProvider.BARRACUDA),
        (r"\.barracuda\.com\.?$", InferredProvider.BARRACUDA),
        # Cisco
        (r"\.iphmx\.com\.?$", InferredProvider.CISCO),
        (r"\.cisco\.com\.?$", InferredProvider.CISCO),
    ]

    # Provider sensitivity profiles
    PROVIDER_PROFILES = {
        InferredProvider.GOOGLE: ProviderSensitivity(
            name="Google Workspace / Gmail",
            dkim_strict=True,
            dmarc_strict=True,
            anti_spoofing=True,
            impersonation_detection=True,
            notes="Strong on DKIM/DMARC alignment. Reputation-based filtering.",
        ),
        InferredProvider.MICROSOFT: ProviderSensitivity(
            name="Microsoft 365 / Exchange Online",
            dkim_strict=True,
            dmarc_strict=True,
            anti_spoofing=True,
            impersonation_detection=True,
            notes="Aggressive anti-spoofing. EOP/ATP may quarantine suspicious messages.",
        ),
        InferredProvider.PROOFPOINT: ProviderSensitivity(
            name="Proofpoint",
            dkim_strict=True,
            dmarc_strict=True,
            anti_spoofing=True,
            impersonation_detection=True,
            notes="Enterprise-grade filtering. Strong impersonation detection heuristics.",
        ),
        InferredProvider.MIMECAST: ProviderSensitivity(
            name="Mimecast",
            dkim_strict=True,
            dmarc_strict=True,
            anti_spoofing=True,
            impersonation_detection=True,
            notes="Advanced threat protection. May reject unauthenticated mail.",
        ),
        InferredProvider.BARRACUDA: ProviderSensitivity(
            name="Barracuda",
            dkim_strict=True,
            dmarc_strict=False,
            anti_spoofing=True,
            impersonation_detection=True,
            notes="Uses both DNS-based and heuristic filtering. BRBL reputation checks.",
        ),
        InferredProvider.CISCO: ProviderSensitivity(
            name="Cisco Email Security",
            dkim_strict=True,
            dmarc_strict=True,
            anti_spoofing=True,
            impersonation_detection=True,
            notes="IronPort/ESA. SenderBase reputation scoring.",
        ),
        InferredProvider.OTHER: ProviderSensitivity(
            name="Unknown/Other",
            dkim_strict=False,
            dmarc_strict=False,
            anti_spoofing=False,
            impersonation_detection=False,
            notes="Provider not identified. Filtering behavior unknown.",
        ),
    }

    async def collect(self) -> MxInferenceInfo:
        """Collect MX records and infer provider."""
        resolver = dns.asyncresolver.Resolver()
        resolver.timeout = 2.0
        resolver.lifetime = 3.0

        info = MxInferenceInfo()

        try:
            answers = await resolver.resolve(self.domain, "MX")

            # Collect MX records
            for rdata in answers:
                info.mx_records.append(
                    {
                        "preference": rdata.preference,
                        "exchange": str(rdata.exchange).rstrip("."),
                    }
                )

            # Sort by preference
            info.mx_records.sort(key=lambda x: x["preference"])

            # Infer provider from MX records
            info.inferred_provider = self._infer_provider(info.mx_records)
            info.sensitivity = self.PROVIDER_PROFILES.get(
                info.inferred_provider, self.PROVIDER_PROFILES[InferredProvider.OTHER]
            )

        except dns.resolver.NXDOMAIN:
            info.inferred_provider = InferredProvider.OTHER
            info.sensitivity = self.PROVIDER_PROFILES[InferredProvider.OTHER]
        except dns.resolver.NoAnswer:
            info.inferred_provider = InferredProvider.OTHER
            info.sensitivity = self.PROVIDER_PROFILES[InferredProvider.OTHER]
        except Exception:
            info.inferred_provider = InferredProvider.OTHER
            info.sensitivity = self.PROVIDER_PROFILES[InferredProvider.OTHER]

        return info

    def _infer_provider(self, mx_records: list[dict]) -> InferredProvider:
        """Infer email provider from MX records."""
        # Check each MX record against patterns
        for mx in mx_records:
            exchange = mx["exchange"].lower()

            for pattern, provider in self.MX_PATTERNS:
                if re.search(pattern, exchange, re.IGNORECASE):
                    return provider

        return InferredProvider.OTHER
