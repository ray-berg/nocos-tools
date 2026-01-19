You are an expert full-stack engineer working inside an existing monorepo “Internal Tools Portal” with:

Backend: Python 3.12 + FastAPI at apps/portal-api

Frontend: React + Vite + TypeScript + Tailwind at apps/portal-web

NGINX serves the built frontend and proxies /api to FastAPI

Tool plugin model:

backend tool routers under apps/portal-api/app/tools/<toolId>/...

frontend tools under apps/portal-web/src/tools/<toolId>/index.tsx

tool metadata returned by GET /api/tools, nav is auto-built from this

Target: Add a new tool with id domain-interrogator.

Constraints:

Ubuntu 24.04 runtime

No authentication

Third-party APIs are allowed

Do not introduce Docker

Implement safely: strict timeouts, sane rate limits, caching, and guardrails against abuse

Goal

Given a single domain name, produce a comprehensive report of publicly available signals relevant to diagnosing service interruptions:

Registrar / registration details (via RDAP/WHOIS equivalent)

Expiration and status flags (clientHold, serverHold, etc.)

Delegation: parent vs child nameservers; authoritative DNS detection; SOA details; detection of lame delegation / NS mismatch

DNS records: A/AAAA/CNAME, NS, SOA, MX, TXT (SPF/DMARC), CAA

DNSSEC posture (DS at parent; DNSKEY/RRSIG checks where possible)

Email routing + filtering heuristics:

parse MX and infer common providers (Google, Microsoft, Proofpoint, Mimecast, Barracuda, Cloudflare Area 1, etc.) using deterministic pattern matches

parse SPF and warn on lookup-count risk

parse DMARC and summarize policy

check MTA-STS and TLS-RPT records

Web hosting signals:

HTTP/HTTPS reachability for apex and www, redirect chain summary (GET with small byte limit or HEAD fallback)

TLS cert inspection: issuer, SANs, expiry, chain summary

CDN/WAF inference (Cloudflare/Fastly/Akamai/CloudFront) via DNS patterns + headers + ASN where available

IP intelligence:

For resolved A/AAAA, provide ASN/ORG and geolocation (country/region/city) via third-party APIs

Subdomain discovery (public passive sources):

Certificate Transparency enumeration (crt.sh is acceptable as a public endpoint)

Extract subdomains, normalize, deduplicate, and show top N

“Interruption risk flags” summary:

cert expires soon

DNSSEC misconfiguration hints

NS mismatch (parent vs authoritative)

single-provider NS concentration

MX/SPF/DMARC inconsistency warnings

CAA present and restrictive

apex vs www mismatch or IPv6-only/broken signals

status flags like serverHold/clientHold

Backend implementation (FastAPI)

Create apps/portal-api/app/tools/domain_interrogator/ with:

metadata.py (tool metadata)

router.py (FastAPI router)

collectors/ package with modules that each return structured results:

rdap.py

dns.py

dnssec.py

mail.py

web.py

ipintel.py

subdomains_ct.py

risk.py (aggregator/scoring)

models.py defining Pydantic models for request/response and collector outputs

Tool endpoints:

POST /api/tools/domain-interrogator/run

Request: { "domain": "example.com", "options": { ... } }

Response: a single JSON report:

summary (providers, key records, risk flags)

collectors (per collector results)

timings and warnings

GET /api/tools/domain-interrogator/presets (optional)

Returns toggles/defaults, e.g. whether to include CT enumeration

Guardrails:

Validate domain strictly:

accept FQDN or bare domain; normalize to lower-case; strip trailing dot

reject IP literals, schemes, paths, wildcards, spaces, underscores, and obviously invalid TLDs

Timeouts:

total request budget (soft) ~ 12 seconds, with per-collector timeouts (e.g. 2–5s)

Concurrency:

use asyncio.gather with bounded concurrency (semaphore) so one request cannot spawn unlimited network calls

Caching:

in-memory TTL cache (e.g., cachetools.TTLCache) keyed by (domain, option set) for ~10 minutes

cache subdomain CT results separately (they can be slow)

Rate limiting:

implement a simple in-process limiter (e.g., token bucket per client IP from request headers, or global limiter). Keep it minimal and internal-friendly.

HTTP client:

use httpx.AsyncClient with strict timeouts and small response size caps

Do not perform invasive port scans. Limit to:

DNS queries

limited HTTP(S) requests for https://domain and https://www.domain (and optional http://...)

certificate retrieval

Third-party APIs (implement as adapters with env-driven configuration):

RDAP: use IANA bootstrap approach (no API key) by querying RDAP endpoints based on TLD if possible, or use a known RDAP library. Prefer direct RDAP HTTP queries with caching.

CT: query crt.sh JSON endpoint with rate limiting and caching.

IP geo: implement adapters in priority order:

IPINFO_TOKEN -> ipinfo.io (if token present)

fall back to ip-api.com (no key, rate-limited)

ASN: either:

parse from ipinfo if present, otherwise

use bgpview.io (no key) with caching

Add env vars to apps/portal-api/app/core/settings.py:

DOMAIN_INTEL_CACHE_TTL_S default 600

DOMAIN_INTEL_HTTP_TIMEOUT_S default 4

IPINFO_TOKEN optional

DOMAIN_INTEL_CT_MAX_RESULTS default e.g. 200

DOMAIN_INTEL_SUBDOMAIN_LIMIT default e.g. 200

DOMAIN_INTEL_WEB_FETCH default true

DOMAIN_INTEL_DNSSEC_CHECK default true

Dependencies (backend):

dnspython for DNS queries

publicsuffix2 or similar to determine registrable domain (optional but useful)

cachetools

httpx (already likely present)

cryptography / ssl usage for cert inspection (use stdlib ssl + socket if possible; otherwise keep dependencies minimal)

DNS specifics

Determine authoritative nameservers:

query NS from parent/recursive

then query SOA directly against each NS (authoritative query) and record:

whether it answers authoritatively

SOA serial values per NS

Compare:

parent NS set vs authoritative NS set

report mismatch and potential outage risk

Query key records using dnspython:

A, AAAA, CNAME, NS, SOA, MX, TXT, CAA

Parse TXT:

SPF: extract v=spf1 ..., estimate DNS lookup count risk (10 limit warning)

DMARC: _dmarc.<domain> TXT parsing

DNSSEC (best-effort, non-invasive)

Attempt:

DS at parent (via recursive query for DS)

DNSKEY at zone apex

Report: enabled/disabled/indeterminate + warnings if DS exists but DNSKEY missing, etc.

Keep as “signals”, not a full validator, but flag common break patterns.

Web/TLS

For https://domain and https://www.domain:

do a GET with a small max bytes read (e.g. 64KB) OR HEAD if GET blocked

record:

status code

redirect chain (up to 5)

selected headers (server, via, cf-ray, x-cache, etc.)

TLS cert:

fetch cert from 443 for domain and www

record issuer CN/O, notBefore/notAfter, SANs count, and whether name matches

flag if expiry within 14/30 days (two thresholds)

Subdomains (CT)

Query crt.sh for domain and %.domain patterns (handle rate limiting)

Extract DNS names from results, normalize, dedupe

Display:

top N by recency if available

include last seen/issuer if present

Frontend implementation (React tool module)

Create apps/portal-web/src/tools/domain-interrogator/index.tsx exporting:

toolMeta matching backend metadata

default React component

UI requirements:

Input: domain (single)

Run button

Options toggles:

include web checks

include subdomain CT

include dnssec

Output:

Summary cards: registrar, expiry, NS, MX provider guess, web/CDN guess, key IP/ASN, major risk flags

Section tabs or accordions:

Registration (RDAP)

DNS (records + delegation + SOA)

DNSSEC

Mail (MX, SPF, DMARC, MTA-STS)

Web/TLS

IP Intelligence

Subdomains (CT)

Raw JSON viewer (collapsed by default)

Provide “Copy report JSON” button.

Make the UI fast and readable; do not overdesign.

Frontend API client:

call POST /api/tools/domain-interrogator/run

show progress states

display errors cleanly

Testing

Backend (pytest):

domain validation tests (reject invalid)

DNS collector unit tests should be written with mocking (do not rely on live DNS)

CT and IP intel should be mocked

Risk scoring logic tests (pure functions)

Frontend (vitest):

renders tool page

mocks API response and verifies summary sections render

Linting / formatting

Ensure existing lint/test targets pass. Add new modules to exports as needed.

Deliverables

Implement all code changes needed in both backend and frontend, including:

tool registration so it appears in /api/tools and navigation

new API endpoints

UI page

tests

any updates to README “how to add tools” if necessary

Do not ask questions. Proceed with sensible defaults and implement now.
