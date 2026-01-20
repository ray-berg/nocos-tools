import { useState } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'

export const metadata: ToolMetadata = {
  id: 'ssl-inspector',
  name: 'SSL Certificate Inspector',
  description: 'Analyze TLS/SSL certificates including chain, expiry, and security details',
  category: 'Network',
  nav_order: 45,
  tags: ['ssl', 'tls', 'certificate', 'https', 'security', 'expiry', 'chain'],
  has_backend: true,
}

interface CertificateInfo {
  subject: Record<string, string>
  issuer: Record<string, string>
  serial_number: string | null
  version: number | null
  not_before: string | null
  not_after: string | null
  days_until_expiry: number | null
  status: 'valid' | 'expiring_soon' | 'expired' | 'not_yet_valid' | 'invalid'
  subject_alt_names: string[]
  key_type: string | null
  key_bits: number | null
  signature_algorithm: string | null
  fingerprint_sha256: string | null
  fingerprint_sha1: string | null
  is_self_signed: boolean
  is_ca: boolean
}

interface ChainInfo {
  certificates: CertificateInfo[]
  chain_valid: boolean
  chain_complete: boolean
  issues: string[]
}

interface ConnectionInfo {
  protocol_version: string | null
  cipher_suite: string | null
  cipher_bits: number | null
  server_hostname: string | null
  alpn_protocol: string | null
}

interface SslReport {
  hostname: string
  port: number
  queried_at: string
  connection: ConnectionInfo | null
  certificate: CertificateInfo | null
  chain: ChainInfo | null
  errors: string[]
}

const statusColors: Record<string, string> = {
  valid: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  expiring_soon: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
  expired: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
  not_yet_valid: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
  invalid: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300',
}

const statusLabels: Record<string, string> = {
  valid: 'Valid',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  not_yet_valid: 'Not Yet Valid',
  invalid: 'Invalid',
}

export function SslInspectorTool() {
  const [hostname, setHostname] = useState('')
  const [port, setPort] = useState(443)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<SslReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hostname.trim()) return

    setLoading(true)
    setError(null)
    setReport(null)

    try {
      const res = await fetch('/api/tools/ssl-inspector/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: hostname.trim(), port }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to inspect certificate')
      }

      const data = await res.json()
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleString()
  }

  const cert = report?.certificate

  return (
    <ToolWrapper metadata={metadata}>
      <div className="space-y-6">
        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={hostname}
              onChange={e => setHostname(e.target.value)}
              placeholder="Enter hostname (e.g., example.com)"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="w-24">
            <input
              type="number"
              value={port}
              onChange={e => setPort(Number(e.target.value))}
              min={1}
              max={65535}
              className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !hostname.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Inspecting...' : 'Inspect'}
          </button>
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

        {/* Certificate Summary */}
        {cert && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="font-medium text-gray-700 dark:text-gray-300">Certificate Summary</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[cert.status]}`}>
                {statusLabels[cert.status]}
              </span>
            </div>
            <div className="p-4 space-y-4">
              {/* Subject */}
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Subject</div>
                <div className="font-mono text-gray-900 dark:text-gray-100">
                  {cert.subject.commonName || cert.subject.CN || 'N/A'}
                </div>
              </div>

              {/* Issuer */}
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Issuer</div>
                <div className="font-mono text-gray-900 dark:text-gray-100">
                  {cert.issuer.organizationName || cert.issuer.O || cert.issuer.commonName || cert.issuer.CN || 'N/A'}
                </div>
              </div>

              {/* Validity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Valid From</div>
                  <div className="text-gray-900 dark:text-gray-100">{formatDate(cert.not_before)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Valid Until</div>
                  <div className="text-gray-900 dark:text-gray-100">{formatDate(cert.not_after)}</div>
                </div>
              </div>

              {/* Days until expiry */}
              {cert.days_until_expiry !== null && (
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Days Until Expiry</div>
                  <div className={`text-lg font-bold ${
                    cert.days_until_expiry < 0 ? 'text-red-600 dark:text-red-400' :
                    cert.days_until_expiry <= 30 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-green-600 dark:text-green-400'
                  }`}>
                    {cert.days_until_expiry < 0 ? `Expired ${Math.abs(cert.days_until_expiry)} days ago` : `${cert.days_until_expiry} days`}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Technical Details */}
        {cert && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <span className="font-medium text-gray-700 dark:text-gray-300">Technical Details</span>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Key Type</span>
                <span className="font-mono text-gray-900 dark:text-gray-100">
                  {cert.key_type} {cert.key_bits ? `(${cert.key_bits} bits)` : ''}
                </span>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Signature Algorithm</span>
                <span className="font-mono text-gray-900 dark:text-gray-100">{cert.signature_algorithm || 'N/A'}</span>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Serial Number</span>
                <span className="font-mono text-gray-900 dark:text-gray-100 text-xs">{cert.serial_number || 'N/A'}</span>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Version</span>
                <span className="font-mono text-gray-900 dark:text-gray-100">v{cert.version}</span>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Self-Signed</span>
                <span className={cert.is_self_signed ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}>
                  {cert.is_self_signed ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">CA Certificate</span>
                <span className="text-gray-900 dark:text-gray-100">{cert.is_ca ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Subject Alternative Names */}
        {cert && cert.subject_alt_names.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Subject Alternative Names ({cert.subject_alt_names.length})
              </span>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {cert.subject_alt_names.map((san, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-700 dark:text-gray-300"
                  >
                    {san}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Fingerprints */}
        {cert && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <span className="font-medium text-gray-700 dark:text-gray-300">Fingerprints</span>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              <div className="px-4 py-3">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">SHA-256</div>
                <div className="font-mono text-xs text-gray-900 dark:text-gray-100 break-all">
                  {cert.fingerprint_sha256 || 'N/A'}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">SHA-1</div>
                <div className="font-mono text-xs text-gray-900 dark:text-gray-100 break-all">
                  {cert.fingerprint_sha1 || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Connection Info */}
        {report?.connection && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <span className="font-medium text-gray-700 dark:text-gray-300">Connection Details</span>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Protocol</span>
                <span className="font-mono text-gray-900 dark:text-gray-100">{report.connection.protocol_version || 'N/A'}</span>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Cipher Suite</span>
                <span className="font-mono text-gray-900 dark:text-gray-100 text-sm">{report.connection.cipher_suite || 'N/A'}</span>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Cipher Strength</span>
                <span className="font-mono text-gray-900 dark:text-gray-100">
                  {report.connection.cipher_bits ? `${report.connection.cipher_bits} bits` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Chain Issues */}
        {report?.chain && report.chain.issues.length > 0 && (
          <div className="border border-yellow-200 dark:border-yellow-800 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
              <span className="font-medium text-yellow-800 dark:text-yellow-300">Chain Issues</span>
            </div>
            <div className="p-4">
              <ul className="list-disc list-inside text-yellow-700 dark:text-yellow-400 text-sm space-y-1">
                {report.chain.issues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </ToolWrapper>
  )
}

export default SslInspectorTool
