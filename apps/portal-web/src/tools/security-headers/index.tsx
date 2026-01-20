import { useState } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'

export const metadata: ToolMetadata = {
  id: 'security-headers',
  name: 'Security Headers Analyzer',
  description: 'Evaluate HTTP security headers with scoring and recommendations',
  category: 'Network',
  nav_order: 46,
  tags: ['security', 'headers', 'csp', 'hsts', 'http', 'https', 'xss', 'clickjacking'],
  has_backend: true,
}

type Grade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'

interface HeaderAnalysis {
  name: string
  present: boolean
  value: string | null
  grade: Grade
  description: string
  recommendation: string | null
  details: string[]
}

interface SecurityReport {
  url: string
  final_url: string
  queried_at: string
  overall_grade: Grade
  overall_score: number
  headers_analyzed: HeaderAnalysis[]
  raw_headers: Record<string, string>
  redirect_chain: string[]
  errors: string[]
}

const gradeColors: Record<Grade, string> = {
  'A+': 'bg-green-500 text-white',
  'A': 'bg-green-500 text-white',
  'B': 'bg-lime-500 text-white',
  'C': 'bg-yellow-500 text-white',
  'D': 'bg-orange-500 text-white',
  'F': 'bg-red-500 text-white',
}

export function SecurityHeadersTool() {
  const [url, setUrl] = useState('')
  const [followRedirects, setFollowRedirects] = useState(true)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<SecurityReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showRawHeaders, setShowRawHeaders] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    setLoading(true)
    setError(null)
    setReport(null)

    try {
      const res = await fetch('/api/tools/security-headers/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl, follow_redirects: followRedirects }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to analyze headers')
      }

      const data = await res.json()
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ToolWrapper metadata={metadata}>
      <div className="space-y-6">
        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="Enter URL (e.g., example.com)"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          <label className="inline-flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={followRedirects}
              onChange={e => setFollowRedirects(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Follow redirects</span>
          </label>
        </form>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Report Errors */}
        {report?.errors && report.errors.length > 0 && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">Warnings</div>
            <ul className="list-disc list-inside text-yellow-700 dark:text-yellow-400 text-sm">
              {report.errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Overall Score */}
        {report && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="p-6 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Overall Security Score</div>
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {report.overall_score}/100
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {report.final_url !== report.url && (
                    <span>Final URL: {report.final_url}</span>
                  )}
                </div>
              </div>
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold ${gradeColors[report.overall_grade]}`}>
                {report.overall_grade}
              </div>
            </div>
          </div>
        )}

        {/* Redirect Chain */}
        {report?.redirect_chain && report.redirect_chain.length > 1 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <span className="font-medium text-gray-700 dark:text-gray-300">Redirect Chain</span>
            </div>
            <div className="p-4">
              {report.redirect_chain.map((redirectUrl, idx) => (
                <div key={idx} className="flex items-center text-sm">
                  {idx > 0 && (
                    <svg className="w-4 h-4 mx-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  )}
                  <span className={`font-mono ${idx === report.redirect_chain.length - 1 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                    {redirectUrl}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Header Analysis */}
        {report?.headers_analyzed && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <span className="font-medium text-gray-700 dark:text-gray-300">Security Headers</span>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {report.headers_analyzed.map((header) => (
                <div key={header.name} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold ${gradeColors[header.grade]}`}>
                        {header.grade}
                      </span>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{header.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{header.description}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      header.present
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    }`}>
                      {header.present ? 'Present' : 'Missing'}
                    </span>
                  </div>

                  {header.value && (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm font-mono text-gray-700 dark:text-gray-300 break-all">
                      {header.value}
                    </div>
                  )}

                  {header.details.length > 0 && (
                    <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-400 list-disc list-inside">
                      {header.details.map((detail, idx) => (
                        <li key={idx}>{detail}</li>
                      ))}
                    </ul>
                  )}

                  {header.recommendation && (
                    <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                      Recommendation: {header.recommendation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw Headers */}
        {report?.raw_headers && Object.keys(report.raw_headers).length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowRawHeaders(!showRawHeaders)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Raw Headers ({Object.keys(report.raw_headers).length})
              </span>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${showRawHeaders ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showRawHeaders && (
              <div className="p-4 max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(report.raw_headers).map(([key, value]) => (
                      <tr key={key} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <td className="py-1 pr-4 font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap align-top">
                          {key}
                        </td>
                        <td className="py-1 font-mono text-gray-900 dark:text-gray-100 break-all">
                          {value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </ToolWrapper>
  )
}

export default SecurityHeadersTool
