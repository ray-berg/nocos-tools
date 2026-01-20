"""Email reputation collectors package."""

from app.tools.email_reputation.collectors.behavioral import BehavioralCollector
from app.tools.email_reputation.collectors.dkim import DkimCollector
from app.tools.email_reputation.collectors.dmarc import DmarcCollector
from app.tools.email_reputation.collectors.dnsbl import DnsblCollector
from app.tools.email_reputation.collectors.mx_inference import MxInferenceCollector
from app.tools.email_reputation.collectors.ptr import PtrCollector
from app.tools.email_reputation.collectors.risk import RiskCollector
from app.tools.email_reputation.collectors.smtp_tls import SmtpTlsCollector
from app.tools.email_reputation.collectors.spf import SpfCollector

__all__ = [
    "SpfCollector",
    "DkimCollector",
    "DmarcCollector",
    "PtrCollector",
    "DnsblCollector",
    "SmtpTlsCollector",
    "MxInferenceCollector",
    "BehavioralCollector",
    "RiskCollector",
]
