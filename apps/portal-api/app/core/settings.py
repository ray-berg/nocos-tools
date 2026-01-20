from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Internal Tools Portal"
    debug: bool = False
    api_prefix: str = "/api"
    host: str = "127.0.0.1"
    port: int = 9000

    # URL Inspector settings
    request_timeout: float = 5.0
    max_redirects: int = 3

    # Domain Interrogator settings
    domain_intel_cache_ttl_s: int = 600
    domain_intel_http_timeout_s: float = 4.0
    domain_intel_ct_max_results: int = 200
    domain_intel_subdomain_limit: int = 200
    domain_intel_web_fetch: bool = True
    domain_intel_dnssec_check: bool = True
    ipinfo_token: str | None = None

    # Email Reputation Analyzer settings
    email_rep_cache_ttl_s: int = 300
    email_rep_dnsbl_timeout_s: float = 3.0
    email_rep_smtp_timeout_s: float = 5.0

    class Config:
        env_prefix = "PORTAL_"


settings = Settings()
