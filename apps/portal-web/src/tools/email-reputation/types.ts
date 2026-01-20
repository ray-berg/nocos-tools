/**
 * TypeScript types for Email Reputation Analyzer tool.
 * These match the backend Pydantic models.
 */

// Request/Response types
export interface RunRequest {
  domain: string
  sending_ip?: string
  from_address?: string
  helo_hostname?: string
  assume_provider?: 'microsoft365' | 'google'
}

export interface PresetsResponse {
  cache_ttl_seconds: number
}

// SPF types
export type SpfStatus = 'passable' | 'fragile' | 'broken'

export interface SpfInfo {
  record?: string
  exists: boolean
  status: SpfStatus
  mechanisms: string[]
  lookup_count: number
  all_mechanism?: string
  has_redirect: boolean
  has_multiple_records: boolean
  issues: string[]
}

// DKIM types
export type DkimStatus = 'present' | 'likely_present' | 'unknown'

export interface DkimSelector {
  selector: string
  key_type?: string
  key_bits?: number
  weak_key: boolean
}

export interface DkimInfo {
  status: DkimStatus
  selectors_found: DkimSelector[]
  selectors_checked: string[]
  issues: string[]
}

// DMARC types
export type DmarcStatus = 'strict' | 'enforcing' | 'monitoring' | 'absent'

export interface DmarcInfo {
  record?: string
  exists: boolean
  status: DmarcStatus
  policy?: string
  subdomain_policy?: string
  alignment_dkim?: string
  alignment_spf?: string
  pct: number
  rua: string[]
  ruf: string[]
  issues: string[]
}

// PTR types
export type PtrStatus = 'aligned' | 'exists_mismatched' | 'missing'

export interface PtrInfo {
  status: PtrStatus
  ptr_hostname?: string
  forward_ips: string[]
  fcrdns_valid: boolean
  issues: string[]
}

// DNSBL types
export interface DnsblListing {
  zone: string
  listed: boolean
  return_code?: string
  meaning?: string
}

export interface DnsblInfo {
  ip_listings: DnsblListing[]
  domain_listings: DnsblListing[]
  total_listings: number
  issues: string[]
}

// SMTP TLS types
export type SmtpTlsStatus = 'modern' | 'degraded' | 'absent' | 'unknown'

export interface SmtpTlsInfo {
  status: SmtpTlsStatus
  mx_host?: string
  starttls_supported: boolean
  certificate_valid: boolean
  certificate_hostname_match: boolean
  tls_version?: string
  issues: string[]
}

// MX Inference types
export type InferredProvider =
  | 'google'
  | 'microsoft'
  | 'proofpoint'
  | 'mimecast'
  | 'barracuda'
  | 'cisco'
  | 'other'

export interface ProviderSensitivity {
  name: string
  dkim_strict: boolean
  dmarc_strict: boolean
  anti_spoofing: boolean
  impersonation_detection: boolean
  notes?: string
}

export interface MxRecord {
  preference: number
  exchange: string
}

export interface MxInferenceInfo {
  mx_records: MxRecord[]
  inferred_provider: InferredProvider
  sensitivity?: ProviderSensitivity
}

// Behavioral types
export type BehavioralRisk = 'low' | 'medium' | 'elevated'

export interface BehavioralInfo {
  risk: BehavioralRisk
  domain_age_days?: number
  is_new_domain: boolean
  issues: string[]
}

// Risk types
export type RiskLevel = 'low' | 'medium' | 'medium_high' | 'high' | 'critical'

export interface RiskInfo {
  overall_risk: RiskLevel
  score: number
  likely_failure_modes: string[]
  can_rule_out: string[]
  cannot_determine: string[]
}

// Auth posture
export interface AuthPosture {
  spf?: SpfInfo
  dkim?: DkimInfo
  dmarc?: DmarcInfo
}

// Infrastructure trust
export interface InfrastructureTrust {
  ptr?: PtrInfo
  helo_consistent?: boolean
  smtp_tls?: SmtpTlsInfo
}

// Main report type
export interface EmailReputationReport {
  domain: string
  queried_at: string
  cached: boolean
  options: Record<string, unknown>

  risk?: RiskInfo
  auth?: AuthPosture
  infrastructure?: InfrastructureTrust
  reputation?: DnsblInfo
  provider?: MxInferenceInfo
  behavioral?: BehavioralInfo

  errors: string[]
}
