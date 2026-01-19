/**
 * TypeScript types for Domain Interrogator tool.
 * These match the backend Pydantic models.
 */

// Request/Response types
export interface RunRequest {
  domain: string
  include_web: boolean
  include_ct: boolean
  include_dnssec: boolean
}

export interface PresetsResponse {
  default_include_web: boolean
  default_include_ct: boolean
  default_include_dnssec: boolean
  cache_ttl_seconds: number
}

// RDAP types
export interface RdapContact {
  name?: string
  organization?: string
  email?: string
}

export interface RdapInfo {
  registrar?: string
  creation_date?: string
  expiration_date?: string
  updated_date?: string
  status: string[]
  nameservers: string[]
  registrant?: RdapContact
  error?: string
}

// DNS types
export interface DnsRecord {
  name: string
  type: string
  ttl: number
  value: string
}

export interface DelegationInfo {
  nameservers: string[]
  ns_ips: Record<string, string[]>
  is_lame: boolean
  lame_ns: string[]
}

export interface DnsInfo {
  records: DnsRecord[]
  delegation?: DelegationInfo
  error?: string
}

// DNSSEC types
export interface DnssecInfo {
  enabled: boolean
  valid: boolean
  ds_records: string[]
  dnskey_records: string[]
  has_rrsig: boolean
  error?: string
}

// Mail types
export interface SpfInfo {
  record?: string
  exists: boolean
  is_valid: boolean
  mechanisms: string[]
  lookup_count: number
  all_mechanism?: string
  warnings: string[]
}

export interface DmarcInfo {
  record?: string
  exists: boolean
  policy?: string
  subdomain_policy?: string
  pct: number
  rua: string[]
  ruf: string[]
  warnings: string[]
}

export interface MtaStsInfo {
  exists: boolean
  mode?: string
  mx_hosts: string[]
  max_age?: number
  error?: string
}

export interface MxRecord {
  preference: number
  exchange: string
}

export interface MailInfo {
  mx_records: MxRecord[]
  spf?: SpfInfo
  dmarc?: DmarcInfo
  mta_sts?: MtaStsInfo
  tls_rpt?: string
  error?: string
}

// Web/TLS types
export interface TlsCertInfo {
  subject: string
  issuer: string
  serial_number: string
  not_before: string
  not_after: string
  days_until_expiry: number
  san_domains: string[]
  is_expired: boolean
  is_expiring_soon: boolean
}

export interface WebInfo {
  http_reachable: boolean
  https_reachable: boolean
  http_status?: number
  https_status?: number
  http_redirects_to_https: boolean
  hsts_enabled: boolean
  hsts_max_age?: number
  server_header?: string
  tls_cert?: TlsCertInfo
  tls_version?: string
  error?: string
}

// IP Intelligence types
export interface IpIntelRecord {
  ip: string
  hostname?: string
  city?: string
  region?: string
  country?: string
  country_code?: string
  org?: string
  asn?: string
  isp?: string
  is_anycast: boolean
}

export interface IpIntelInfo {
  records: IpIntelRecord[]
  error?: string
}

// Subdomains types
export interface SubdomainInfo {
  subdomains: string[]
  total_found: number
  truncated: boolean
  error?: string
}

// Risk types
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface RiskFlag {
  severity: RiskSeverity
  category: string
  message: string
  points_deducted: number
}

export interface RiskInfo {
  score: number
  grade: string
  flags: RiskFlag[]
}

// Main report type
export interface DomainReport {
  domain: string
  queried_at: string
  cached: boolean
  options: Record<string, boolean>

  rdap?: RdapInfo
  dns?: DnsInfo
  dnssec?: DnssecInfo
  mail?: MailInfo
  web?: WebInfo
  ip_intel?: IpIntelInfo
  subdomains?: SubdomainInfo
  risk?: RiskInfo

  errors: string[]
}
