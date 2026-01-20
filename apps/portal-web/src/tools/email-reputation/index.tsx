import { useState } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'
import type { EmailReputationReport, RunRequest } from './types'
import { RiskSummary } from './components/RiskSummary'
import { AuthSection } from './components/AuthSection'
import { InfraSection } from './components/InfraSection'
import { ReputationSection } from './components/ReputationSection'
import { ProviderSection } from './components/ProviderSection'
import { BehavioralSection } from './components/BehavioralSection'

export const metadata: ToolMetadata = {
  id: 'email-reputation',
  name: 'Email Reputation Analyzer',
  description:
    'Assess email deliverability risk based on authentication, reputation, and policy signals',
  category: 'Network',
  nav_order: 26,
  tags: [
    'email',
    'deliverability',
    'spf',
    'dkim',
    'dmarc',
    'reputation',
    'dnsbl',
    'blacklist',
    'smtp',
  ],
  has_backend: true,
}

type TabId = 'risk' | 'auth' | 'infra' | 'reputation' | 'provider' | 'behavioral'

const tabs: { id: TabId; label: string }[] = [
  { id: 'risk', label: 'Risk Summary' },
  { id: 'auth', label: 'Authentication' },
  { id: 'infra', label: 'Infrastructure' },
  { id: 'reputation', label: 'Reputation' },
  { id: 'provider', label: 'Provider' },
  { id: 'behavioral', label: 'Behavioral' },
]

export function EmailReputationTool() {
  const [domain, setDomain] = useState('')
  const [sendingIp, setSendingIp] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [fromAddress, setFromAddress] = useState('')
  const [heloHostname, setHeloHostname] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<EmailReputationReport | null>(null)

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
        sending_ip: sendingIp.trim() || undefined,
        from_address: fromAddress.trim() || undefined,
        helo_hostname: heloHostname.trim() || undefined,
      }

      const res = await fetch('/api/tools/email-reputation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || `HTTP ${res.status}`)
      }

      const data: EmailReputationReport = await res.json()
      setReport(data)
      setActiveTab('risk')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyJson = () => {
    if (report) {
      navigator.clipboard.writeText(JSON.stringify(report, null, 2))
    }
  }

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
                Sending Domain *
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
            <div className="flex-1">
              <label
                htmlFor="sendingIp"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Sending IP (optional)
              </label>
              <input
                type="text"
                id="sendingIp"
                value={sendingIp}
                onChange={(e) => setSendingIp(e.target.value)}
                placeholder="192.0.2.1"
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

          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Advanced Options
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <label
                  htmlFor="fromAddress"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  From Address
                </label>
                <input
                  type="text"
                  id="fromAddress"
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                  placeholder="sender@example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label
                  htmlFor="heloHostname"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  HELO/EHLO Hostname
                </label>
                <input
                  type="text"
                  id="heloHostname"
                  value={heloHostname}
                  onChange={(e) => setHeloHostname(e.target.value)}
                  placeholder="mail.example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
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
              <span>Analyzing email reputation...</span>
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
                  Analyzed at {new Date(report.queried_at).toLocaleString()}
                  {report.cached && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-800">
                      cached
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={handleCopyJson}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Copy JSON
              </button>
            </div>

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
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="-mb-px flex space-x-4 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[200px]">
              {activeTab === 'risk' && <RiskSummary risk={report.risk} />}
              {activeTab === 'auth' && <AuthSection auth={report.auth} />}
              {activeTab === 'infra' && <InfraSection infrastructure={report.infrastructure} />}
              {activeTab === 'reputation' && <ReputationSection reputation={report.reputation} />}
              {activeTab === 'provider' && <ProviderSection provider={report.provider} />}
              {activeTab === 'behavioral' && <BehavioralSection behavioral={report.behavioral} />}
            </div>
          </div>
        )}
      </div>
    </ToolWrapper>
  )
}

export default EmailReputationTool
