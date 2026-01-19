import { useState } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'
import type { DomainReport, RunRequest } from './types'
import { SummaryCard } from './components/SummaryCard'
import { SectionTabs } from './components/SectionTabs'
import { RdapSection } from './components/RdapSection'
import { DnsSection } from './components/DnsSection'
import { DnssecSection } from './components/DnssecSection'
import { EmailSection } from './components/EmailSection'
import { WebSection } from './components/WebSection'
import { IpIntelSection } from './components/IpIntelSection'
import { SubdomainsSection } from './components/SubdomainsSection'
import { RiskSection } from './components/RiskSection'
import { CopyJsonButton } from './components/CopyJsonButton'

export const metadata: ToolMetadata = {
  id: 'domain-interrogator',
  name: 'Domain Interrogator',
  description:
    'Comprehensive domain intelligence: DNS, DNSSEC, email config, TLS, RDAP, and subdomain discovery',
  category: 'Network',
  nav_order: 25,
  tags: [
    'domain',
    'dns',
    'dnssec',
    'email',
    'spf',
    'dmarc',
    'tls',
    'ssl',
    'certificate',
    'rdap',
    'whois',
    'subdomain',
    'security',
  ],
  has_backend: true,
}

type TabId = 'risk' | 'dns' | 'dnssec' | 'email' | 'web' | 'ipintel' | 'subdomains' | 'rdap'

export function DomainInterrogatorTool() {
  const [domain, setDomain] = useState('')
  const [includeWeb, setIncludeWeb] = useState(true)
  const [includeCt, setIncludeCt] = useState(true)
  const [includeDnssec, setIncludeDnssec] = useState(true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<DomainReport | null>(null)

  const [activeTab, setActiveTab] = useState<TabId>('risk')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!domain.trim()) return

    setLoading(true)
    setError(null)
    setReport(null)

    try {
      const request: RunRequest = {
        domain: domain.trim(),
        include_web: includeWeb,
        include_ct: includeCt,
        include_dnssec: includeDnssec,
      }

      const res = await fetch('/api/tools/domain-interrogator/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || `HTTP ${res.status}`)
      }

      const data: DomainReport = await res.json()
      setReport(data)
      setActiveTab('risk')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'risk' as TabId, label: 'Risk', count: report?.risk?.flags.length },
    { id: 'dns' as TabId, label: 'DNS', count: report?.dns?.records.length },
    { id: 'dnssec' as TabId, label: 'DNSSEC' },
    { id: 'email' as TabId, label: 'Email' },
    { id: 'web' as TabId, label: 'Web/TLS' },
    { id: 'ipintel' as TabId, label: 'IP Intel', count: report?.ip_intel?.records.length },
    {
      id: 'subdomains' as TabId,
      label: 'Subdomains',
      count: report?.subdomains?.total_found,
    },
    { id: 'rdap' as TabId, label: 'RDAP' },
  ]

  return (
    <ToolWrapper metadata={metadata}>
      <div className="space-y-6">
        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label
                htmlFor="domain"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Domain
              </label>
              <input
                type="text"
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading || !domain.trim()}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                {loading ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={includeWeb}
                onChange={(e) => setIncludeWeb(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              Web/TLS Check
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={includeDnssec}
                onChange={(e) => setIncludeDnssec(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              DNSSEC Validation
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={includeCt}
                onChange={(e) => setIncludeCt(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              CT Subdomains
            </label>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Interrogating domain...</span>
            </div>
          </div>
        )}

        {/* Results */}
        {report && !loading && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {report.domain}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Queried at {new Date(report.queried_at).toLocaleString()}
                  {report.cached && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-800">
                      cached
                    </span>
                  )}
                </p>
              </div>
              <CopyJsonButton report={report} />
            </div>

            {/* Summary Cards */}
            <SummaryCard report={report} />

            {/* Errors */}
            {report.errors.length > 0 && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  Collection Issues
                </h4>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  {report.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tabs */}
            <SectionTabs
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab as TabId)}
              tabs={tabs}
            />

            {/* Tab Content */}
            <div className="min-h-[200px]">
              {activeTab === 'risk' && <RiskSection risk={report.risk} />}
              {activeTab === 'dns' && <DnsSection dns={report.dns} />}
              {activeTab === 'dnssec' && <DnssecSection dnssec={report.dnssec} />}
              {activeTab === 'email' && <EmailSection mail={report.mail} />}
              {activeTab === 'web' && <WebSection web={report.web} />}
              {activeTab === 'ipintel' && <IpIntelSection ipIntel={report.ip_intel} />}
              {activeTab === 'subdomains' && (
                <SubdomainsSection subdomains={report.subdomains} />
              )}
              {activeTab === 'rdap' && <RdapSection rdap={report.rdap} />}
            </div>
          </div>
        )}
      </div>
    </ToolWrapper>
  )
}

export default DomainInterrogatorTool
