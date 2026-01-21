import { useState } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'

export const metadata: ToolMetadata = {
  id: 'ip-lookup',
  name: 'IP/ASN Lookup',
  description: 'IP address intelligence, geolocation, and ASN information',
  category: 'Network',
  nav_order: 45,
  tags: ['ip', 'asn', 'geolocation', 'whois', 'ptr', 'reverse-dns'],
  has_backend: true,
}

interface GeoLocation {
  country?: string
  country_code?: string
  region?: string
  region_code?: string
  city?: string
  zip_code?: string
  latitude?: number
  longitude?: number
  timezone?: string
}

interface ASNInfo {
  asn?: number
  as_name?: string
  as_org?: string
}

interface IPTypeInfo {
  version: number
  is_private: boolean
  is_loopback: boolean
  is_multicast: boolean
  is_reserved: boolean
  is_link_local: boolean
}

interface NetworkInfo {
  ptr?: string
  isp?: string
  org?: string
  is_hosting?: boolean
  is_proxy?: boolean
  is_vpn?: boolean
  is_tor?: boolean
}

interface IPLookupResult {
  ip: string
  ip_type: IPTypeInfo
  geolocation?: GeoLocation
  asn?: ASNInfo
  network?: NetworkInfo
  error?: string
}

export function IpLookupTool() {
  const [ip, setIp] = useState('')
  const [result, setResult] = useState<IPLookupResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLookup = async () => {
    if (!ip.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/tools/ip-lookup/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: ip.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Lookup failed')
      }

      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const loadMyIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      setIp(data.ip)
    } catch {
      setError('Could not detect your IP address')
    }
  }

  const loadSample = (sampleIp: string) => {
    setIp(sampleIp)
    setResult(null)
    setError(null)
  }

  const getIpTypeLabel = (ipType: IPTypeInfo): string => {
    const labels: string[] = [`IPv${ipType.version}`]
    if (ipType.is_private) labels.push('Private')
    if (ipType.is_loopback) labels.push('Loopback')
    if (ipType.is_multicast) labels.push('Multicast')
    if (ipType.is_reserved) labels.push('Reserved')
    if (ipType.is_link_local) labels.push('Link-local')
    if (!ipType.is_private && !ipType.is_loopback && !ipType.is_reserved && !ipType.is_link_local) {
      labels.push('Public')
    }
    return labels.join(' • ')
  }

  return (
    <ToolWrapper metadata={metadata}>
      <div className="space-y-6">
        {/* Input */}
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              IP Address
            </label>
            <input
              type="text"
              value={ip}
              onChange={e => setIp(e.target.value)}
              placeholder="e.g., 8.8.8.8 or 2001:4860:4860::8888"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
            />
          </div>
          <button
            onClick={handleLookup}
            disabled={loading || !ip.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Looking up...' : 'Lookup'}
          </button>
        </div>

        {/* Quick links */}
        <div className="flex gap-4 flex-wrap">
          <button
            onClick={loadMyIP}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Use my IP
          </button>
          <span className="text-gray-400">|</span>
          <span className="text-sm text-gray-500">Samples:</span>
          <button
            onClick={() => loadSample('8.8.8.8')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            8.8.8.8
          </button>
          <button
            onClick={() => loadSample('1.1.1.1')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            1.1.1.1
          </button>
          <button
            onClick={() => loadSample('208.67.222.222')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            208.67.222.222
          </button>
          <button
            onClick={() => loadSample('2001:4860:4860::8888')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            IPv6
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
            {/* IP Header */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-mono font-medium text-gray-900 dark:text-gray-100">
                    {result.ip}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {getIpTypeLabel(result.ip_type)}
                  </p>
                </div>
                {result.geolocation?.country_code && (
                  <span className="text-4xl" title={result.geolocation.country}>
                    {getFlagEmoji(result.geolocation.country_code)}
                  </span>
                )}
              </div>
            </div>

            {/* Warning for private IPs */}
            {result.error && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-700 dark:text-yellow-400">
                {result.error}
              </div>
            )}

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Geolocation */}
              {result.geolocation && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Geolocation
                  </h4>
                  <dl className="space-y-2 text-sm">
                    {result.geolocation.country && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Country</dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {result.geolocation.country}
                        </dd>
                      </div>
                    )}
                    {result.geolocation.region && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Region</dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {result.geolocation.region}
                        </dd>
                      </div>
                    )}
                    {result.geolocation.city && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">City</dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {result.geolocation.city}
                        </dd>
                      </div>
                    )}
                    {result.geolocation.zip_code && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">ZIP/Postal</dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {result.geolocation.zip_code}
                        </dd>
                      </div>
                    )}
                    {result.geolocation.latitude !== undefined && result.geolocation.longitude !== undefined && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Coordinates</dt>
                        <dd className="text-gray-900 dark:text-gray-100 font-mono text-xs">
                          {result.geolocation.latitude.toFixed(4)}, {result.geolocation.longitude.toFixed(4)}
                        </dd>
                      </div>
                    )}
                    {result.geolocation.timezone && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Timezone</dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {result.geolocation.timezone}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* ASN Info */}
              {result.asn && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    ASN Information
                  </h4>
                  <dl className="space-y-2 text-sm">
                    {result.asn.asn && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">ASN</dt>
                        <dd className="text-gray-900 dark:text-gray-100 font-mono">
                          AS{result.asn.asn}
                        </dd>
                      </div>
                    )}
                    {result.asn.as_name && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">AS Name</dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {result.asn.as_name}
                        </dd>
                      </div>
                    )}
                    {result.asn.as_org && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Organization</dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {result.asn.as_org}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* Network Info */}
              {result.network && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Network Information
                  </h4>
                  <dl className="space-y-2 text-sm">
                    {result.network.ptr && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">PTR Record</dt>
                        <dd className="text-gray-900 dark:text-gray-100 font-mono text-xs break-all">
                          {result.network.ptr}
                        </dd>
                      </div>
                    )}
                    {result.network.isp && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">ISP</dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {result.network.isp}
                        </dd>
                      </div>
                    )}
                    {result.network.org && result.network.org !== result.network.isp && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Organization</dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {result.network.org}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* Flags */}
              {result.network && (result.network.is_hosting || result.network.is_proxy || result.network.is_vpn || result.network.is_tor) && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Detection Flags
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {result.network.is_hosting && (
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded">
                        Hosting/Datacenter
                      </span>
                    )}
                    {result.network.is_proxy && (
                      <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs rounded">
                        Proxy
                      </span>
                    )}
                    {result.network.is_vpn && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">
                        VPN
                      </span>
                    )}
                    {result.network.is_tor && (
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs rounded">
                        Tor Exit
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* IP Type Details */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  IP Classification
                </h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Version</dt>
                    <dd className="text-gray-900 dark:text-gray-100">
                      IPv{result.ip_type.version}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Type</dt>
                    <dd>
                      {result.ip_type.is_private ? (
                        <span className="text-orange-600 dark:text-orange-400">Private</span>
                      ) : result.ip_type.is_loopback ? (
                        <span className="text-gray-600 dark:text-gray-400">Loopback</span>
                      ) : result.ip_type.is_reserved ? (
                        <span className="text-gray-600 dark:text-gray-400">Reserved</span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">Public</span>
                      )}
                    </dd>
                  </div>
                  {result.ip_type.is_multicast && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Multicast</dt>
                      <dd className="text-gray-900 dark:text-gray-100">Yes</dd>
                    </div>
                  )}
                  {result.ip_type.is_link_local && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Link-local</dt>
                      <dd className="text-gray-900 dark:text-gray-100">Yes</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolWrapper>
  )
}

function getFlagEmoji(countryCode: string): string {
  // Convert country code to flag emoji
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

export default IpLookupTool
