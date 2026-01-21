import { useState } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'

export const metadata: ToolMetadata = {
  id: 'http-probe',
  name: 'HTTP Probe',
  description: 'Detailed HTTP request analysis with timing breakdown',
  category: 'Network',
  nav_order: 46,
  tags: ['http', 'timing', 'headers', 'request', 'response', 'ttfb', 'latency'],
  has_backend: true,
}

interface TimingInfo {
  dns_lookup_ms?: number
  tcp_connect_ms?: number
  tls_handshake_ms?: number
  time_to_first_byte_ms?: number
  content_download_ms?: number
  total_ms: number
}

interface RedirectHop {
  url: string
  status_code: number
  location?: string
}

interface ResponseInfo {
  status_code: number
  status_text: string
  http_version: string
  headers: Record<string, string>
  content_type?: string
  content_length?: number
  content_encoding?: string
  body_preview?: string
  body_size: number
}

interface ProbeResult {
  request_url: string
  final_url: string
  method: string
  timing: TimingInfo
  response: ResponseInfo
  redirects: RedirectHop[]
  tls_used: boolean
  error?: string
}

type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS'

export function HttpProbeTool() {
  const [url, setUrl] = useState('')
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [followRedirects, setFollowRedirects] = useState(true)
  const [customHeaders, setCustomHeaders] = useState('')
  const [result, setResult] = useState<ProbeResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'response' | 'headers' | 'body' | 'timing'>('response')

  const handleProbe = async () => {
    if (!url.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Parse custom headers
      let headers: Record<string, string> | undefined
      if (customHeaders.trim()) {
        headers = {}
        for (const line of customHeaders.split('\n')) {
          const colonIdx = line.indexOf(':')
          if (colonIdx > 0) {
            const key = line.substring(0, colonIdx).trim()
            const value = line.substring(colonIdx + 1).trim()
            if (key && value) {
              headers[key] = value
            }
          }
        }
      }

      const response = await fetch('/api/tools/http-probe/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          method,
          follow_redirects: followRedirects,
          headers,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Probe failed')
      }

      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400'
    if (status >= 300 && status < 400) return 'text-blue-600 dark:text-blue-400'
    if (status >= 400 && status < 500) return 'text-yellow-600 dark:text-yellow-400'
    if (status >= 500) return 'text-red-600 dark:text-red-400'
    return 'text-gray-600'
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const loadSample = (sampleUrl: string) => {
    setUrl(sampleUrl)
    setResult(null)
    setError(null)
  }

  return (
    <ToolWrapper metadata={metadata}>
      <div className="space-y-6">
        {/* Input */}
        <div className="space-y-4">
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Method
              </label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value as HttpMethod)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="GET">GET</option>
                <option value="HEAD">HEAD</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="OPTIONS">OPTIONS</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                URL
              </label>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={e => e.key === 'Enter' && handleProbe()}
              />
            </div>

            <button
              onClick={handleProbe}
              disabled={loading || !url.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Probing...' : 'Probe'}
            </button>
          </div>

          <div className="flex gap-6 items-center">
            <label className="inline-flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={followRedirects}
                onChange={e => setFollowRedirects(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Follow redirects</span>
            </label>
          </div>

          {/* Custom headers */}
          <details className="group">
            <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
              Custom headers (optional)
            </summary>
            <div className="mt-2">
              <textarea
                value={customHeaders}
                onChange={e => setCustomHeaders(e.target.value)}
                placeholder="Header-Name: value&#10;Another-Header: value"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </details>
        </div>

        {/* Sample URLs */}
        <div className="flex gap-4 flex-wrap">
          <span className="text-sm text-gray-500">Samples:</span>
          <button
            onClick={() => loadSample('https://httpbin.org/get')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            httpbin.org
          </button>
          <button
            onClick={() => loadSample('https://example.com')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            example.com
          </button>
          <button
            onClick={() => loadSample('https://httpstat.us/200')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            httpstat.us
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex flex-wrap items-center gap-4">
                <span className={`text-2xl font-bold ${getStatusColor(result.response.status_code)}`}>
                  {result.response.status_code}
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  {result.response.status_text}
                </span>
                <span className="text-gray-400">|</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {result.response.http_version}
                </span>
                <span className="text-gray-400">|</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {result.timing.total_ms.toFixed(0)} ms
                </span>
                <span className="text-gray-400">|</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {formatBytes(result.response.body_size)}
                </span>
                {result.tls_used && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span className="text-sm text-green-600 dark:text-green-400">
                      TLS
                    </span>
                  </>
                )}
              </div>

              {result.request_url !== result.final_url && (
                <div className="mt-2 text-sm">
                  <span className="text-gray-500">Final URL: </span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">{result.final_url}</span>
                </div>
              )}
            </div>

            {/* Redirects */}
            {result.redirects.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                  Redirect Chain ({result.redirects.length} redirect{result.redirects.length > 1 ? 's' : ''})
                </h4>
                <div className="space-y-1 text-sm">
                  {result.redirects.map((hop, idx) => (
                    <div key={idx} className="flex items-center gap-2 font-mono">
                      <span className={getStatusColor(hop.status_code)}>{hop.status_code}</span>
                      <span className="text-gray-500 truncate">{hop.url}</span>
                      {hop.location && (
                        <>
                          <span className="text-gray-400">→</span>
                          <span className="text-gray-600 dark:text-gray-400 truncate">{hop.location}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex gap-4">
                {(['response', 'headers', 'body', 'timing'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-2 px-1 border-b-2 text-sm font-medium capitalize ${
                      activeTab === tab
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>

            {/* Response Tab */}
            {activeTab === 'response' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Response Info
                  </h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Status</dt>
                      <dd className={getStatusColor(result.response.status_code)}>
                        {result.response.status_code} {result.response.status_text}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">HTTP Version</dt>
                      <dd className="text-gray-900 dark:text-gray-100">{result.response.http_version}</dd>
                    </div>
                    {result.response.content_type && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Content-Type</dt>
                        <dd className="text-gray-900 dark:text-gray-100 font-mono text-xs">
                          {result.response.content_type}
                        </dd>
                      </div>
                    )}
                    {result.response.content_encoding && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Encoding</dt>
                        <dd className="text-gray-900 dark:text-gray-100">{result.response.content_encoding}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Body Size</dt>
                      <dd className="text-gray-900 dark:text-gray-100">{formatBytes(result.response.body_size)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Request Info
                  </h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Method</dt>
                      <dd className="text-gray-900 dark:text-gray-100 font-mono">{result.method}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500 flex-shrink-0">URL</dt>
                      <dd className="text-gray-900 dark:text-gray-100 font-mono text-xs truncate">
                        {result.request_url}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">TLS</dt>
                      <dd className={result.tls_used ? 'text-green-600' : 'text-gray-500'}>
                        {result.tls_used ? 'Yes' : 'No'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Redirects</dt>
                      <dd className="text-gray-900 dark:text-gray-100">{result.redirects.length}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}

            {/* Headers Tab */}
            {activeTab === 'headers' && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300 font-medium">Header</th>
                      <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {Object.entries(result.response.headers).map(([key, value]) => (
                      <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                        <td className="px-4 py-2 font-mono text-gray-600 dark:text-gray-400">{key}</td>
                        <td className="px-4 py-2 font-mono text-gray-900 dark:text-gray-100 break-all">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Body Tab */}
            {activeTab === 'body' && (
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <pre className="p-4 text-sm font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap">
                  {result.response.body_preview || '[No body content]'}
                </pre>
              </div>
            )}

            {/* Timing Tab */}
            {activeTab === 'timing' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                    Request Timing
                  </h4>

                  {/* Timing bar */}
                  <div className="space-y-3">
                    {result.timing.time_to_first_byte_ms !== undefined && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-500">Time to First Byte (TTFB)</span>
                          <span className="font-mono text-gray-900 dark:text-gray-100">
                            {result.timing.time_to_first_byte_ms.toFixed(0)} ms
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{
                              width: `${Math.min(100, (result.timing.time_to_first_byte_ms / result.timing.total_ms) * 100)}%`
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Total Time</span>
                        <span className="font-mono text-gray-900 dark:text-gray-100">
                          {result.timing.total_ms.toFixed(0)} ms
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                        <div className="h-full bg-green-500 w-full" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timing breakdown */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Timing Details
                  </h4>
                  <dl className="space-y-2 text-sm">
                    {result.timing.dns_lookup_ms !== undefined && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">DNS Lookup</dt>
                        <dd className="font-mono text-gray-900 dark:text-gray-100">
                          {result.timing.dns_lookup_ms.toFixed(2)} ms
                        </dd>
                      </div>
                    )}
                    {result.timing.tcp_connect_ms !== undefined && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">TCP Connect</dt>
                        <dd className="font-mono text-gray-900 dark:text-gray-100">
                          {result.timing.tcp_connect_ms.toFixed(2)} ms
                        </dd>
                      </div>
                    )}
                    {result.timing.tls_handshake_ms !== undefined && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">TLS Handshake</dt>
                        <dd className="font-mono text-gray-900 dark:text-gray-100">
                          {result.timing.tls_handshake_ms.toFixed(2)} ms
                        </dd>
                      </div>
                    )}
                    {result.timing.time_to_first_byte_ms !== undefined && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Time to First Byte</dt>
                        <dd className="font-mono text-gray-900 dark:text-gray-100">
                          {result.timing.time_to_first_byte_ms.toFixed(2)} ms
                        </dd>
                      </div>
                    )}
                    {result.timing.content_download_ms !== undefined && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Content Download</dt>
                        <dd className="font-mono text-gray-900 dark:text-gray-100">
                          {result.timing.content_download_ms.toFixed(2)} ms
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                      <dt className="text-gray-700 dark:text-gray-300 font-medium">Total</dt>
                      <dd className="font-mono font-medium text-gray-900 dark:text-gray-100">
                        {result.timing.total_ms.toFixed(2)} ms
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ToolWrapper>
  )
}

export default HttpProbeTool
