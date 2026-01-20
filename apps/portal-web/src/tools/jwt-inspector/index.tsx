import { useState, useEffect } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'

export const metadata: ToolMetadata = {
  id: 'jwt-inspector',
  name: 'JWT Inspector',
  description: 'Decode and analyze JSON Web Tokens',
  category: 'Security',
  nav_order: 41,
  tags: ['jwt', 'token', 'auth', 'decode', 'json', 'security'],
  has_backend: false,
}

interface DecodedJWT {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
  isValid: boolean
  error?: string
}

const KNOWN_CLAIMS: Record<string, string> = {
  iss: 'Issuer - Who issued the token',
  sub: 'Subject - Who the token is about',
  aud: 'Audience - Who the token is intended for',
  exp: 'Expiration Time - When the token expires',
  nbf: 'Not Before - When the token becomes valid',
  iat: 'Issued At - When the token was issued',
  jti: 'JWT ID - Unique identifier for the token',
}

const ALGORITHM_INFO: Record<string, { name: string; security: 'high' | 'medium' | 'low' | 'none' }> = {
  HS256: { name: 'HMAC with SHA-256', security: 'medium' },
  HS384: { name: 'HMAC with SHA-384', security: 'medium' },
  HS512: { name: 'HMAC with SHA-512', security: 'medium' },
  RS256: { name: 'RSA with SHA-256', security: 'high' },
  RS384: { name: 'RSA with SHA-384', security: 'high' },
  RS512: { name: 'RSA with SHA-512', security: 'high' },
  ES256: { name: 'ECDSA with SHA-256', security: 'high' },
  ES384: { name: 'ECDSA with SHA-384', security: 'high' },
  ES512: { name: 'ECDSA with SHA-512', security: 'high' },
  PS256: { name: 'RSA-PSS with SHA-256', security: 'high' },
  PS384: { name: 'RSA-PSS with SHA-384', security: 'high' },
  PS512: { name: 'RSA-PSS with SHA-512', security: 'high' },
  none: { name: 'No digital signature', security: 'none' },
}

function base64UrlDecode(str: string): string {
  // Add padding if needed
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  try {
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
  } catch {
    return atob(base64)
  }
}

function decodeJWT(token: string): DecodedJWT {
  const parts = token.trim().split('.')

  if (parts.length !== 3) {
    return {
      header: {},
      payload: {},
      signature: '',
      isValid: false,
      error: 'Invalid JWT format: expected 3 parts separated by dots',
    }
  }

  try {
    const header = JSON.parse(base64UrlDecode(parts[0]))
    const payload = JSON.parse(base64UrlDecode(parts[1]))
    const signature = parts[2]

    return {
      header,
      payload,
      signature,
      isValid: true,
    }
  } catch (e) {
    return {
      header: {},
      payload: {},
      signature: '',
      isValid: false,
      error: `Failed to decode JWT: ${e instanceof Error ? e.message : 'Unknown error'}`,
    }
  }
}

function formatTimestamp(value: unknown): string {
  if (typeof value !== 'number') return String(value)

  const date = new Date(value * 1000)
  const now = new Date()
  const diff = date.getTime() - now.getTime()

  const formatted = date.toLocaleString()

  if (diff < 0) {
    const ago = Math.abs(diff)
    if (ago < 60000) return `${formatted} (${Math.floor(ago / 1000)}s ago)`
    if (ago < 3600000) return `${formatted} (${Math.floor(ago / 60000)}m ago)`
    if (ago < 86400000) return `${formatted} (${Math.floor(ago / 3600000)}h ago)`
    return `${formatted} (${Math.floor(ago / 86400000)}d ago)`
  } else {
    if (diff < 60000) return `${formatted} (in ${Math.floor(diff / 1000)}s)`
    if (diff < 3600000) return `${formatted} (in ${Math.floor(diff / 60000)}m)`
    if (diff < 86400000) return `${formatted} (in ${Math.floor(diff / 3600000)}h)`
    return `${formatted} (in ${Math.floor(diff / 86400000)}d)`
  }
}

function getExpiryStatus(payload: Record<string, unknown>): { status: 'valid' | 'expired' | 'not-yet-valid' | 'unknown'; message: string } {
  const now = Math.floor(Date.now() / 1000)
  const exp = payload.exp as number | undefined
  const nbf = payload.nbf as number | undefined

  if (nbf && now < nbf) {
    return { status: 'not-yet-valid', message: 'Token is not yet valid' }
  }

  if (exp && now > exp) {
    return { status: 'expired', message: 'Token has expired' }
  }

  if (exp) {
    return { status: 'valid', message: 'Token is valid' }
  }

  return { status: 'unknown', message: 'No expiration set' }
}

export function JwtInspectorTool() {
  const [token, setToken] = useState('')
  const [decoded, setDecoded] = useState<DecodedJWT | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (token.trim()) {
      setDecoded(decodeJWT(token))
    } else {
      setDecoded(null)
    }
  }, [token])

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const expiryStatus = decoded?.isValid ? getExpiryStatus(decoded.payload) : null
  const algorithm = decoded?.header?.alg as string | undefined
  const algorithmInfo = algorithm ? ALGORITHM_INFO[algorithm] : null

  const statusColors = {
    valid: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    expired: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    'not-yet-valid': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    unknown: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300',
  }

  const securityColors = {
    high: 'text-green-600 dark:text-green-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    low: 'text-orange-600 dark:text-orange-400',
    none: 'text-red-600 dark:text-red-400',
  }

  return (
    <ToolWrapper metadata={metadata}>
      <div className="space-y-6">
        {/* Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            JWT Token
          </label>
          <textarea
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="Paste your JWT token here (eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Error */}
        {decoded && !decoded.isValid && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {decoded.error}
          </div>
        )}

        {/* Decoded JWT */}
        {decoded?.isValid && (
          <div className="space-y-6">
            {/* Status Bar */}
            <div className="flex flex-wrap gap-3">
              {expiryStatus && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[expiryStatus.status]}`}>
                  {expiryStatus.message}
                </span>
              )}
              {algorithmInfo && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300">
                  {algorithm}: {algorithmInfo.name}
                  <span className={`ml-2 ${securityColors[algorithmInfo.security]}`}>
                    ({algorithmInfo.security} security)
                  </span>
                </span>
              )}
            </div>

            {/* Header */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
                <span className="font-medium text-blue-800 dark:text-blue-300">Header</span>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(decoded.header, null, 2), 'header')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {copied === 'header' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="p-4 bg-gray-50 dark:bg-gray-900 overflow-x-auto">
                <code className="text-sm text-gray-800 dark:text-gray-200">
                  {JSON.stringify(decoded.header, null, 2)}
                </code>
              </pre>
            </div>

            {/* Payload */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-purple-50 dark:bg-purple-900/20 border-b border-gray-200 dark:border-gray-700">
                <span className="font-medium text-purple-800 dark:text-purple-300">Payload</span>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(decoded.payload, null, 2), 'payload')}
                  className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                >
                  {copied === 'payload' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(decoded.payload).map(([key, value]) => {
                      const isTimestamp = ['exp', 'nbf', 'iat'].includes(key)
                      const claimInfo = KNOWN_CLAIMS[key]

                      return (
                        <tr key={key} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
                          <td className="py-2 pr-4 font-mono text-gray-600 dark:text-gray-400 align-top whitespace-nowrap">
                            {key}
                            {claimInfo && (
                              <span className="block text-xs text-gray-400 dark:text-gray-500 font-normal">
                                {claimInfo}
                              </span>
                            )}
                          </td>
                          <td className="py-2 font-mono text-gray-900 dark:text-gray-100 break-all">
                            {isTimestamp ? (
                              <span>
                                {String(value)}
                                <span className="block text-xs text-gray-500 dark:text-gray-400">
                                  {formatTimestamp(value)}
                                </span>
                              </span>
                            ) : typeof value === 'object' ? (
                              <pre className="whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
                            ) : (
                              String(value)
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Signature */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border-b border-gray-200 dark:border-gray-700">
                <span className="font-medium text-orange-800 dark:text-orange-300">Signature</span>
                <button
                  onClick={() => copyToClipboard(decoded.signature, 'signature')}
                  className="text-sm text-orange-600 dark:text-orange-400 hover:underline"
                >
                  {copied === 'signature' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900">
                <code className="text-sm text-gray-800 dark:text-gray-200 break-all font-mono">
                  {decoded.signature}
                </code>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Note: Signature verification requires the secret key or public key, which is not supported in this tool.
                </p>
              </div>
            </div>

            {/* Token Parts */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <span className="font-medium text-gray-700 dark:text-gray-300">Token Structure</span>
              </div>
              <div className="p-4 bg-white dark:bg-gray-900">
                <div className="font-mono text-sm break-all">
                  <span className="text-blue-600 dark:text-blue-400">{token.split('.')[0]}</span>
                  <span className="text-gray-400">.</span>
                  <span className="text-purple-600 dark:text-purple-400">{token.split('.')[1]}</span>
                  <span className="text-gray-400">.</span>
                  <span className="text-orange-600 dark:text-orange-400">{token.split('.')[2]}</span>
                </div>
                <div className="mt-2 flex gap-4 text-xs">
                  <span className="text-blue-600 dark:text-blue-400">Header</span>
                  <span className="text-purple-600 dark:text-purple-400">Payload</span>
                  <span className="text-orange-600 dark:text-orange-400">Signature</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!token && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>Paste a JWT token above to decode and inspect it.</p>
            <p className="mt-2 text-sm">
              JWTs are composed of three parts: header, payload, and signature.
            </p>
          </div>
        )}
      </div>
    </ToolWrapper>
  )
}

export default JwtInspectorTool
