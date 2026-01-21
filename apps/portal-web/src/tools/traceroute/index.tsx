import { useState, useEffect } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export const metadata: ToolMetadata = {
  id: 'traceroute',
  name: 'Traceroute',
  description: 'Trace network path to a destination with geolocation map visualization',
  category: 'Network',
  nav_order: 47,
  tags: ['traceroute', 'network', 'path', 'hops', 'latency', 'geolocation', 'map'],
  has_backend: true,
}

// Fix for default marker icons in Leaflet with bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface GeoLocation {
  latitude: number
  longitude: number
  city?: string
  region?: string
  country?: string
  country_code?: string
}

interface HopInfo {
  hop_number: number
  ip?: string
  hostname?: string
  rtt_ms?: number[]
  avg_rtt_ms?: number
  is_timeout: boolean
  is_private: boolean
  geolocation?: GeoLocation
  asn?: number
  as_name?: string
  isp?: string
}

interface RouteExplanation {
  summary: string
  segments: string[]
  total_hops: number
  responsive_hops: number
  countries_traversed: string[]
  estimated_distance_km?: number
}

interface TracerouteResult {
  target: string
  resolved_ip?: string
  hops: HopInfo[]
  explanation?: RouteExplanation
  completed: boolean
  error?: string
}

// Component to fit map bounds to markers
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()

  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])))
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [positions, map])

  return null
}

// Create custom numbered marker icons
function createNumberedIcon(number: number, isStart: boolean, isEnd: boolean): L.DivIcon {
  const color = isStart ? '#10b981' : isEnd ? '#ef4444' : '#3b82f6'
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">${number}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  })
}

export function TracerouteTool() {
  const [target, setTarget] = useState('')
  const [maxHops, setMaxHops] = useState(30)
  const [result, setResult] = useState<TracerouteResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'map' | 'table' | 'explanation'>('map')

  const handleTrace = async () => {
    if (!target.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/tools/traceroute/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: target.trim(),
          max_hops: maxHops,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Traceroute failed')
      }

      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const loadSample = (sampleTarget: string) => {
    setTarget(sampleTarget)
    setResult(null)
    setError(null)
  }

  // Extract positions for map
  const mapPositions: { hop: HopInfo; position: [number, number] }[] = result?.hops
    .filter(h => h.geolocation)
    .map(h => ({
      hop: h,
      position: [h.geolocation!.latitude, h.geolocation!.longitude] as [number, number],
    })) || []

  // Create polyline path
  const pathPositions = mapPositions.map(p => p.position)

  // Get flag emoji
  const getFlagEmoji = (countryCode: string): string => {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0))
    return String.fromCodePoint(...codePoints)
  }

  return (
    <ToolWrapper metadata={metadata}>
      <div className="space-y-6">
        {/* Input */}
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target (IP or Hostname)
            </label>
            <input
              type="text"
              value={target}
              onChange={e => setTarget(e.target.value)}
              placeholder="e.g., 8.8.8.8 or google.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={e => e.key === 'Enter' && !loading && handleTrace()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Max Hops
            </label>
            <select
              value={maxHops}
              onChange={e => setMaxHops(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={45}>45</option>
              <option value={64}>64</option>
            </select>
          </div>

          <button
            onClick={handleTrace}
            disabled={loading || !target.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Tracing...' : 'Trace Route'}
          </button>
        </div>

        {/* Sample targets */}
        <div className="flex gap-4 flex-wrap">
          <span className="text-sm text-gray-500">Samples:</span>
          <button
            onClick={() => loadSample('8.8.8.8')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Google DNS
          </button>
          <button
            onClick={() => loadSample('1.1.1.1')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Cloudflare
          </button>
          <button
            onClick={() => loadSample('cloudflare.com')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            cloudflare.com
          </button>
          <button
            onClick={() => loadSample('amazon.com')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            amazon.com
          </button>
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <span className="text-blue-700 dark:text-blue-300">
                Running traceroute to {target}... This may take up to a minute.
              </span>
            </div>
          </div>
        )}

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
                <div>
                  <span className="text-sm text-gray-500">Target:</span>{' '}
                  <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                    {result.target}
                  </span>
                </div>
                {result.resolved_ip && (
                  <div>
                    <span className="text-sm text-gray-500">Resolved:</span>{' '}
                    <span className="font-mono text-gray-700 dark:text-gray-300">
                      {result.resolved_ip}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-sm text-gray-500">Hops:</span>{' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {result.explanation?.responsive_hops || 0} / {result.hops.length}
                  </span>
                </div>
                {result.completed ? (
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded">
                    Completed
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs rounded">
                    Incomplete
                  </span>
                )}
              </div>
              {result.explanation?.countries_traversed && result.explanation.countries_traversed.length > 0 && (
                <div className="mt-2 text-sm">
                  <span className="text-gray-500">Countries:</span>{' '}
                  {result.explanation.countries_traversed.map((country, i) => (
                    <span key={i} className="inline-flex items-center gap-1 mr-2">
                      {country}
                    </span>
                  ))}
                </div>
              )}
              {result.explanation?.estimated_distance_km && (
                <div className="mt-1 text-sm text-gray-500">
                  Estimated distance: {result.explanation.estimated_distance_km.toLocaleString()} km
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex gap-4">
                {(['map', 'table', 'explanation'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-2 px-1 border-b-2 text-sm font-medium capitalize ${
                      activeTab === tab
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {tab === 'map' ? 'Route Map' : tab}
                  </button>
                ))}
              </nav>
            </div>

            {/* Map View */}
            {activeTab === 'map' && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {mapPositions.length > 0 ? (
                  <div style={{ height: '500px' }}>
                    <MapContainer
                      center={mapPositions[0]?.position || [0, 0]}
                      zoom={2}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <FitBounds positions={pathPositions} />

                      {/* Route line */}
                      {pathPositions.length > 1 && (
                        <Polyline
                          positions={pathPositions}
                          color="#3b82f6"
                          weight={3}
                          opacity={0.7}
                          dashArray="10, 10"
                        />
                      )}

                      {/* Hop markers */}
                      {mapPositions.map(({ hop, position }, index) => (
                        <Marker
                          key={hop.hop_number}
                          position={position}
                          icon={createNumberedIcon(
                            hop.hop_number,
                            index === 0,
                            index === mapPositions.length - 1
                          )}
                        >
                          <Popup>
                            <div className="text-sm">
                              <div className="font-bold">Hop {hop.hop_number}</div>
                              {hop.ip && <div className="font-mono text-xs">{hop.ip}</div>}
                              {hop.geolocation && (
                                <div className="mt-1">
                                  {hop.geolocation.city && <div>{hop.geolocation.city}</div>}
                                  {hop.geolocation.country && (
                                    <div>
                                      {hop.geolocation.country_code && getFlagEmoji(hop.geolocation.country_code)}{' '}
                                      {hop.geolocation.country}
                                    </div>
                                  )}
                                </div>
                              )}
                              {hop.as_name && <div className="text-xs text-gray-500 mt-1">{hop.as_name}</div>}
                              {hop.avg_rtt_ms && <div className="text-xs mt-1">RTT: {hop.avg_rtt_ms} ms</div>}
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    No geolocatable hops found. All hops may be private or unresponsive.
                  </div>
                )}

                {/* Legend */}
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Start</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Intermediate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Destination</span>
                  </div>
                </div>
              </div>
            )}

            {/* Table View */}
            {activeTab === 'table' && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300 font-medium w-12">#</th>
                        <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300 font-medium">IP Address</th>
                        <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300 font-medium">Location</th>
                        <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300 font-medium">Network</th>
                        <th className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 font-medium">RTT (ms)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {result.hops.map(hop => (
                        <tr
                          key={hop.hop_number}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${
                            hop.is_timeout ? 'opacity-50' : ''
                          }`}
                        >
                          <td className="px-3 py-2 text-gray-500">{hop.hop_number}</td>
                          <td className="px-3 py-2 font-mono">
                            {hop.is_timeout ? (
                              <span className="text-gray-400">* * *</span>
                            ) : hop.is_private ? (
                              <span className="text-orange-600 dark:text-orange-400">{hop.ip}</span>
                            ) : (
                              <span className="text-gray-900 dark:text-gray-100">{hop.ip}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {hop.geolocation ? (
                              <div>
                                <span className="text-gray-900 dark:text-gray-100">
                                  {[hop.geolocation.city, hop.geolocation.country]
                                    .filter(Boolean)
                                    .join(', ')}
                                </span>
                                {hop.geolocation.country_code && (
                                  <span className="ml-1">{getFlagEmoji(hop.geolocation.country_code)}</span>
                                )}
                              </div>
                            ) : hop.is_private ? (
                              <span className="text-orange-600 dark:text-orange-400 text-xs">Private</span>
                            ) : hop.is_timeout ? (
                              <span className="text-gray-400">-</span>
                            ) : (
                              <span className="text-gray-400">Unknown</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">
                            {hop.as_name || hop.isp || '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {hop.avg_rtt_ms !== null && hop.avg_rtt_ms !== undefined ? (
                              <span className={
                                hop.avg_rtt_ms < 50 ? 'text-green-600 dark:text-green-400' :
                                hop.avg_rtt_ms < 150 ? 'text-yellow-600 dark:text-yellow-400' :
                                'text-red-600 dark:text-red-400'
                              }>
                                {hop.avg_rtt_ms}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Explanation View */}
            {activeTab === 'explanation' && result.explanation && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Summary</h4>
                  <p className="text-gray-900 dark:text-gray-100">{result.explanation.summary}</p>
                </div>

                {/* Route segments */}
                {result.explanation.segments.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Route Details</h4>
                    <div className="space-y-2">
                      {result.explanation.segments.map((segment, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></div>
                          <span className="text-gray-700 dark:text-gray-300">{segment}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Statistics */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Statistics</h4>
                  <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <dt className="text-gray-500">Total Hops</dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-100">{result.explanation.total_hops}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Responsive</dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-100">{result.explanation.responsive_hops}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Countries</dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-100">
                        {result.explanation.countries_traversed.length}
                      </dd>
                    </div>
                    {result.explanation.estimated_distance_km && (
                      <div>
                        <dt className="text-gray-500">Distance</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">
                          {result.explanation.estimated_distance_km.toLocaleString()} km
                        </dd>
                      </div>
                    )}
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

export default TracerouteTool
