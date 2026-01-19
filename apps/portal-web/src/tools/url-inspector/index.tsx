import { useState, useMemo } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'

export const metadata: ToolMetadata = {
  id: 'url-inspector',
  name: 'URL Inspector',
  description: 'Parse URLs, inspect query parameters, and fetch HEAD information safely',
  category: 'Network',
  nav_order: 20,
  tags: ['url', 'http', 'network', 'debug'],
  has_backend: true,
}

interface ParsedUrl {
  scheme: string
  host: string
  port: string
  path: string
  query: string
  fragment: string
  params: [string, string][]
}

interface HeadResponse {
  status_code: number
  final_url: string
  headers: Record<string, string>
  redirect_count: number
}

function parseUrl(urlStr: string): ParsedUrl | null {
  try {
    const url = new URL(urlStr)
    const params: [string, string][] = []
    url.searchParams.forEach((value, key) => {
      params.push([key, value])
    })
    return {
      scheme: url.protocol.replace(':', ''),
      host: url.hostname,
      port: url.port,
      path: url.pathname,
      query: url.search,
      fragment: url.hash,
      params,
    }
  } catch {
    return null
  }
}

export function UrlInspectorTool() {
  const [url, setUrl] = useState('')
  const [headResult, setHeadResult] = useState<HeadResponse | null>(null)
  const [headError, setHeadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const parsed = useMemo(() => parseUrl(url), [url])

  const fetchHead = async () => {
    if (!url) return

    setLoading(true)
    setHeadError(null)
    setHeadResult(null)

    try {
      const res = await fetch('/api/tools/url-inspector/fetch-head', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || `HTTP ${res.status}`)
      }

      const data = await res.json()
      setHeadResult(data)
    } catch (err) {
      setHeadError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ToolWrapper metadata={metadata}>
      <div className="space-y-6">
        {/* URL Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/path?key=value"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
            <button
              onClick={fetchHead}
              disabled={!parsed || loading}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-lg"
            >
              {loading ? 'Loading...' : 'Fetch HEAD'}
            </button>
          </div>
        </div>

        {/* Parsed Components */}
        {parsed && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Parsed Components
            </h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500 dark:text-gray-400">Scheme</dt>
              <dd className="font-mono text-gray-900 dark:text-white">{parsed.scheme}</dd>

              <dt className="text-gray-500 dark:text-gray-400">Host</dt>
              <dd className="font-mono text-gray-900 dark:text-white">{parsed.host}</dd>

              {parsed.port && (
                <>
                  <dt className="text-gray-500 dark:text-gray-400">Port</dt>
                  <dd className="font-mono text-gray-900 dark:text-white">{parsed.port}</dd>
                </>
              )}

              <dt className="text-gray-500 dark:text-gray-400">Path</dt>
              <dd className="font-mono text-gray-900 dark:text-white">{parsed.path || '/'}</dd>

              {parsed.query && (
                <>
                  <dt className="text-gray-500 dark:text-gray-400">Query</dt>
                  <dd className="font-mono text-gray-900 dark:text-white break-all">
                    {parsed.query}
                  </dd>
                </>
              )}

              {parsed.fragment && (
                <>
                  <dt className="text-gray-500 dark:text-gray-400">Fragment</dt>
                  <dd className="font-mono text-gray-900 dark:text-white">{parsed.fragment}</dd>
                </>
              )}
            </dl>
          </div>
        )}

        {/* Query Parameters */}
        {parsed && parsed.params.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Query Parameters
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Key</th>
                  <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Value</th>
                </tr>
              </thead>
              <tbody>
                {parsed.params.map(([key, value], i) => (
                  <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-3 py-2 font-mono text-gray-900 dark:text-white">{key}</td>
                    <td className="px-3 py-2 font-mono text-gray-900 dark:text-white break-all">
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* HEAD Result */}
        {headError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-300">{headError}</p>
          </div>
        )}

        {headResult && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-green-800 dark:text-green-300 mb-3">
              HEAD Response
            </h3>
            <dl className="grid grid-cols-2 gap-2 text-sm mb-4">
              <dt className="text-green-600 dark:text-green-400">Status</dt>
              <dd className="font-mono text-green-900 dark:text-green-100">
                {headResult.status_code}
              </dd>

              <dt className="text-green-600 dark:text-green-400">Final URL</dt>
              <dd className="font-mono text-green-900 dark:text-green-100 break-all">
                {headResult.final_url}
              </dd>

              {headResult.redirect_count > 0 && (
                <>
                  <dt className="text-green-600 dark:text-green-400">Redirects</dt>
                  <dd className="font-mono text-green-900 dark:text-green-100">
                    {headResult.redirect_count}
                  </dd>
                </>
              )}
            </dl>

            <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">Headers</h4>
            <dl className="text-sm">
              {Object.entries(headResult.headers).map(([key, value]) => (
                <div key={key} className="flex gap-2 py-1">
                  <dt className="text-green-600 dark:text-green-400 font-mono">{key}:</dt>
                  <dd className="text-green-900 dark:text-green-100 font-mono break-all">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {!url && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Enter a URL above to inspect it</p>
        )}

        {url && !parsed && (
          <p className="text-sm text-red-600 dark:text-red-400">Invalid URL format</p>
        )}
      </div>
    </ToolWrapper>
  )
}

export default UrlInspectorTool
