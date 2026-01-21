import { useState, useMemo } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'

export const metadata: ToolMetadata = {
  id: 'log-parser',
  name: 'Log Parser',
  description: 'Parse and analyze common log formats',
  category: 'Data',
  nav_order: 51,
  tags: ['log', 'parse', 'apache', 'nginx', 'syslog', 'json', 'analyze'],
  has_backend: false,
}

type LogFormat = 'auto' | 'apache-combined' | 'apache-common' | 'nginx' | 'syslog' | 'json' | 'custom'

interface ParsedLogEntry {
  raw: string
  lineNumber: number
  parsed: Record<string, string>
  timestamp?: Date
  level?: string
}

interface LogStats {
  totalLines: number
  parsedLines: number
  errorLines: number
  byLevel: Record<string, number>
  byStatusCode: Record<string, number>
  topIps: [string, number][]
  topPaths: [string, number][]
}

// Log format patterns
const LOG_PATTERNS: Record<string, RegExp> = {
  'apache-combined': /^(?<ip>\S+) \S+ \S+ \[(?<timestamp>[^\]]+)\] "(?<method>\S+) (?<path>\S+) (?<protocol>[^"]+)" (?<status>\d+) (?<size>\S+) "(?<referrer>[^"]*)" "(?<useragent>[^"]*)"/,
  'apache-common': /^(?<ip>\S+) \S+ \S+ \[(?<timestamp>[^\]]+)\] "(?<method>\S+) (?<path>\S+) (?<protocol>[^"]+)" (?<status>\d+) (?<size>\S+)/,
  'nginx': /^(?<ip>\S+) - (?<user>\S+) \[(?<timestamp>[^\]]+)\] "(?<method>\S+) (?<path>\S+) (?<protocol>[^"]+)" (?<status>\d+) (?<size>\d+) "(?<referrer>[^"]*)" "(?<useragent>[^"]*)"/,
  'syslog': /^(?<timestamp>\w{3}\s+\d+\s+[\d:]+)\s+(?<host>\S+)\s+(?<process>[^:\[]+)(?:\[(?<pid>\d+)\])?:\s*(?<message>.*)$/,
}

function detectFormat(lines: string[]): LogFormat {
  // Try each format on the first few non-empty lines
  const sampleLines = lines.filter(l => l.trim()).slice(0, 5)

  for (const line of sampleLines) {
    // Check for JSON
    if (line.trim().startsWith('{')) {
      try {
        JSON.parse(line)
        return 'json'
      } catch {
        // Not JSON
      }
    }

    // Check other formats
    for (const [format, pattern] of Object.entries(LOG_PATTERNS)) {
      if (pattern.test(line)) {
        return format as LogFormat
      }
    }
  }

  return 'auto'
}

function parseLogLine(line: string, format: LogFormat, customPattern?: string): Record<string, string> | null {
  if (!line.trim()) return null

  // JSON format
  if (format === 'json') {
    try {
      const parsed = JSON.parse(line)
      // Flatten nested objects
      const flat: Record<string, string> = {}
      const flatten = (obj: unknown, prefix = '') => {
        if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
          for (const [k, v] of Object.entries(obj)) {
            flatten(v, prefix ? `${prefix}.${k}` : k)
          }
        } else {
          flat[prefix] = String(obj)
        }
      }
      flatten(parsed)
      return flat
    } catch {
      return null
    }
  }

  // Custom regex
  if (format === 'custom' && customPattern) {
    try {
      const regex = new RegExp(customPattern)
      const match = line.match(regex)
      if (match?.groups) {
        return match.groups
      }
      if (match) {
        const result: Record<string, string> = {}
        match.slice(1).forEach((v, i) => {
          result[`group${i + 1}`] = v || ''
        })
        return result
      }
    } catch {
      return null
    }
    return null
  }

  // Predefined patterns
  const pattern = LOG_PATTERNS[format]
  if (!pattern) return null

  const match = line.match(pattern)
  if (match?.groups) {
    return match.groups
  }

  return null
}

function parseTimestamp(value: string): Date | undefined {
  // Try common log timestamp formats
  const formats = [
    // Apache/Nginx: 10/Oct/2000:13:55:36 -0700
    /^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s*([+-]\d{4})?$/,
    // Syslog: Oct 10 13:55:36
    /^(\w{3})\s+(\d+)\s+(\d{2}):(\d{2}):(\d{2})$/,
    // ISO: 2000-10-10T13:55:36Z
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
  ]

  // Try ISO parse first
  const isoDate = new Date(value)
  if (!isNaN(isoDate.getTime())) {
    return isoDate
  }

  // Try Apache format
  const apacheMatch = value.match(formats[0])
  if (apacheMatch) {
    const months: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    }
    const [, day, month, year, hour, min, sec] = apacheMatch
    return new Date(parseInt(year), months[month] || 0, parseInt(day), parseInt(hour), parseInt(min), parseInt(sec))
  }

  // Try syslog format (assume current year)
  const syslogMatch = value.match(formats[1])
  if (syslogMatch) {
    const months: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    }
    const [, month, day, hour, min, sec] = syslogMatch
    const now = new Date()
    return new Date(now.getFullYear(), months[month] || 0, parseInt(day), parseInt(hour), parseInt(min), parseInt(sec))
  }

  return undefined
}

function extractLevel(parsed: Record<string, string>): string | undefined {
  const levelKeys = ['level', 'severity', 'loglevel', 'log_level']
  for (const key of levelKeys) {
    const value = parsed[key]?.toLowerCase()
    if (value) return value
  }

  // Check message for common level indicators
  const message = parsed.message || parsed.msg || ''
  const levelPatterns = ['error', 'warn', 'info', 'debug', 'trace', 'fatal', 'critical']
  for (const level of levelPatterns) {
    if (message.toLowerCase().includes(`[${level}]`) || message.toLowerCase().startsWith(`${level}:`)) {
      return level
    }
  }

  return undefined
}

function calculateStats(entries: ParsedLogEntry[]): LogStats {
  const byLevel: Record<string, number> = {}
  const byStatusCode: Record<string, number> = {}
  const ipCounts: Record<string, number> = {}
  const pathCounts: Record<string, number> = {}
  let parsedLines = 0
  let errorLines = 0

  for (const entry of entries) {
    if (Object.keys(entry.parsed).length > 0) {
      parsedLines++
    } else {
      errorLines++
    }

    // Count levels
    if (entry.level) {
      byLevel[entry.level] = (byLevel[entry.level] || 0) + 1
    }

    // Count status codes
    const status = entry.parsed.status
    if (status) {
      const statusGroup = `${status[0]}xx`
      byStatusCode[statusGroup] = (byStatusCode[statusGroup] || 0) + 1
    }

    // Count IPs
    const ip = entry.parsed.ip || entry.parsed.remote_addr || entry.parsed.client_ip
    if (ip) {
      ipCounts[ip] = (ipCounts[ip] || 0) + 1
    }

    // Count paths
    const path = entry.parsed.path || entry.parsed.uri || entry.parsed.request_uri
    if (path) {
      pathCounts[path] = (pathCounts[path] || 0) + 1
    }
  }

  // Sort and take top 10
  const topIps = Object.entries(ipCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const topPaths = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  return {
    totalLines: entries.length,
    parsedLines,
    errorLines,
    byLevel,
    byStatusCode,
    topIps,
    topPaths,
  }
}

export function LogParserTool() {
  const [input, setInput] = useState('')
  const [format, setFormat] = useState<LogFormat>('auto')
  const [customPattern, setCustomPattern] = useState('')
  const [filterField, setFilterField] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [activeTab, setActiveTab] = useState<'table' | 'stats' | 'raw'>('table')

  const { detectedFormat, entries, stats, fields } = useMemo(() => {
    if (!input.trim()) {
      return { detectedFormat: 'auto' as LogFormat, entries: [], stats: null, fields: [] }
    }

    const lines = input.split(/\r?\n/)
    const detected = format === 'auto' ? detectFormat(lines) : format
    const actualFormat = detected === 'auto' ? 'apache-combined' : detected

    const parsed: ParsedLogEntry[] = []
    const fieldSet = new Set<string>()

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.trim()) continue

      const parsedLine = parseLogLine(line, actualFormat, customPattern) || {}
      Object.keys(parsedLine).forEach(k => fieldSet.add(k))

      const timestamp = parsedLine.timestamp ? parseTimestamp(parsedLine.timestamp) : undefined
      const level = extractLevel(parsedLine)

      parsed.push({
        raw: line,
        lineNumber: i + 1,
        parsed: parsedLine,
        timestamp,
        level,
      })
    }

    return {
      detectedFormat: detected,
      entries: parsed,
      stats: calculateStats(parsed),
      fields: Array.from(fieldSet).sort(),
    }
  }, [input, format, customPattern])

  const filteredEntries = useMemo(() => {
    if (!filterField || !filterValue) return entries

    return entries.filter(entry => {
      const value = entry.parsed[filterField]
      if (!value) return false
      return value.toLowerCase().includes(filterValue.toLowerCase())
    })
  }, [entries, filterField, filterValue])

  const loadSample = (type: 'apache' | 'nginx' | 'json' | 'syslog') => {
    const samples: Record<string, string> = {
      apache: `192.168.1.100 - - [10/Oct/2023:13:55:36 -0700] "GET /index.html HTTP/1.1" 200 2326 "https://example.com" "Mozilla/5.0"
192.168.1.101 - - [10/Oct/2023:13:55:37 -0700] "GET /api/users HTTP/1.1" 200 1234 "-" "curl/7.68.0"
192.168.1.102 - - [10/Oct/2023:13:55:38 -0700] "POST /api/login HTTP/1.1" 401 89 "https://example.com/login" "Mozilla/5.0"
192.168.1.100 - - [10/Oct/2023:13:55:39 -0700] "GET /images/logo.png HTTP/1.1" 304 0 "https://example.com" "Mozilla/5.0"
192.168.1.103 - - [10/Oct/2023:13:55:40 -0700] "GET /nonexistent HTTP/1.1" 404 162 "-" "Mozilla/5.0"`,
      nginx: `192.168.1.100 - john [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 "https://example.com" "Mozilla/5.0"
192.168.1.101 - - [10/Oct/2023:13:55:37 +0000] "GET /api/users HTTP/1.1" 200 1234 "-" "curl/7.68.0"
192.168.1.102 - admin [10/Oct/2023:13:55:38 +0000] "POST /api/data HTTP/1.1" 500 89 "-" "Python/3.9"`,
      json: `{"timestamp":"2023-10-10T13:55:36Z","level":"info","message":"Application started","service":"api"}
{"timestamp":"2023-10-10T13:55:37Z","level":"debug","message":"Processing request","requestId":"abc123","path":"/api/users"}
{"timestamp":"2023-10-10T13:55:38Z","level":"error","message":"Database connection failed","error":"timeout","service":"api"}
{"timestamp":"2023-10-10T13:55:39Z","level":"warn","message":"High memory usage","memoryMb":850,"threshold":800}`,
      syslog: `Oct 10 13:55:36 webserver nginx[1234]: Connection from 192.168.1.100
Oct 10 13:55:37 webserver sshd[5678]: Accepted publickey for admin
Oct 10 13:55:38 dbserver mysql[9012]: Query completed in 1.5s
Oct 10 13:55:39 webserver kernel: Out of memory: Kill process 1234`,
    }
    setInput(samples[type])
    setFormat('auto')
  }

  const getLevelColor = (level: string | undefined) => {
    switch (level?.toLowerCase()) {
      case 'error':
      case 'fatal':
      case 'critical':
        return 'text-red-600 dark:text-red-400'
      case 'warn':
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'info':
        return 'text-blue-600 dark:text-blue-400'
      case 'debug':
      case 'trace':
        return 'text-gray-500 dark:text-gray-400'
      default:
        return 'text-gray-700 dark:text-gray-300'
    }
  }

  const getStatusColor = (status: string) => {
    if (status.startsWith('2')) return 'text-green-600 dark:text-green-400'
    if (status.startsWith('3')) return 'text-blue-600 dark:text-blue-400'
    if (status.startsWith('4')) return 'text-yellow-600 dark:text-yellow-400'
    if (status.startsWith('5')) return 'text-red-600 dark:text-red-400'
    return 'text-gray-700 dark:text-gray-300'
  }

  return (
    <ToolWrapper metadata={metadata}>
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Log Format
            </label>
            <select
              value={format}
              onChange={e => setFormat(e.target.value as LogFormat)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="auto">Auto-detect</option>
              <option value="apache-combined">Apache Combined</option>
              <option value="apache-common">Apache Common</option>
              <option value="nginx">Nginx</option>
              <option value="syslog">Syslog</option>
              <option value="json">JSON</option>
              <option value="custom">Custom Regex</option>
            </select>
          </div>

          {format === 'custom' && (
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Custom Pattern (use named groups)
              </label>
              <input
                type="text"
                value={customPattern}
                onChange={e => setCustomPattern(e.target.value)}
                placeholder="(?<ip>\S+) (?<message>.*)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
              />
            </div>
          )}

          {format === 'auto' && detectedFormat !== 'auto' && (
            <div className="text-sm text-gray-500 dark:text-gray-400 pb-2">
              Detected: <span className="font-medium">{detectedFormat}</span>
            </div>
          )}
        </div>

        {/* Sample buttons */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-gray-500 dark:text-gray-400">Load sample:</span>
          <button onClick={() => loadSample('apache')} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Apache
          </button>
          <button onClick={() => loadSample('nginx')} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Nginx
          </button>
          <button onClick={() => loadSample('json')} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            JSON
          </button>
          <button onClick={() => loadSample('syslog')} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Syslog
          </button>
        </div>

        {/* Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Log Data
          </label>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Paste your log data here..."
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Results */}
        {entries.length > 0 && (
          <>
            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex gap-4">
                {(['table', 'stats', 'raw'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-2 px-1 border-b-2 text-sm font-medium ${
                      activeTab === tab
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {tab === 'table' ? 'Parsed Data' : tab === 'stats' ? 'Statistics' : 'Raw'}
                  </button>
                ))}
              </nav>
            </div>

            {/* Filter (for table view) */}
            {activeTab === 'table' && fields.length > 0 && (
              <div className="flex gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Filter by field
                  </label>
                  <select
                    value={filterField}
                    onChange={e => setFilterField(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">All entries</option>
                    {fields.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                {filterField && (
                  <div className="flex-1 max-w-xs">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Contains
                    </label>
                    <input
                      type="text"
                      value={filterValue}
                      onChange={e => setFilterValue(e.target.value)}
                      placeholder="Filter value..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                )}
                {filterField && (
                  <span className="text-sm text-gray-500 dark:text-gray-400 pb-2">
                    {filteredEntries.length} of {entries.length} entries
                  </span>
                )}
              </div>
            )}

            {/* Table View */}
            {activeTab === 'table' && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium w-12">#</th>
                        {fields.slice(0, 8).map(field => (
                          <th key={field} className="px-3 py-2 text-left text-gray-700 dark:text-gray-300 font-medium">
                            {field}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredEntries.slice(0, 100).map((entry, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-3 py-2 text-gray-400">{entry.lineNumber}</td>
                          {fields.slice(0, 8).map(field => (
                            <td
                              key={field}
                              className={`px-3 py-2 max-w-xs truncate ${
                                field === 'status' ? getStatusColor(entry.parsed[field] || '') :
                                field === 'level' || entry.level ? getLevelColor(entry.level) :
                                'text-gray-900 dark:text-gray-100'
                              }`}
                              title={entry.parsed[field]}
                            >
                              {entry.parsed[field] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredEntries.length > 100 && (
                  <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-sm text-gray-500">
                    Showing first 100 of {filteredEntries.length} entries
                  </div>
                )}
              </div>
            )}

            {/* Stats View */}
            {activeTab === 'stats' && stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Summary */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Lines</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{stats.totalLines}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Parsed</span>
                      <span className="font-medium text-green-600">{stats.parsedLines}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Unparsed</span>
                      <span className="font-medium text-red-600">{stats.errorLines}</span>
                    </div>
                  </div>
                </div>

                {/* Status Codes */}
                {Object.keys(stats.byStatusCode).length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Status Codes</h3>
                    <div className="space-y-2 text-sm">
                      {Object.entries(stats.byStatusCode).sort().map(([code, count]) => (
                        <div key={code} className="flex justify-between">
                          <span className={getStatusColor(code)}>{code}</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Log Levels */}
                {Object.keys(stats.byLevel).length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Log Levels</h3>
                    <div className="space-y-2 text-sm">
                      {Object.entries(stats.byLevel).map(([level, count]) => (
                        <div key={level} className="flex justify-between">
                          <span className={getLevelColor(level)}>{level}</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top IPs */}
                {stats.topIps.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Top IPs</h3>
                    <div className="space-y-2 text-sm">
                      {stats.topIps.slice(0, 5).map(([ip, count]) => (
                        <div key={ip} className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400 font-mono">{ip}</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Paths */}
                {stats.topPaths.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 md:col-span-2">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Top Paths</h3>
                    <div className="space-y-2 text-sm">
                      {stats.topPaths.slice(0, 5).map(([path, count]) => (
                        <div key={path} className="flex justify-between gap-4">
                          <span className="text-gray-600 dark:text-gray-400 font-mono truncate">{path}</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100 flex-shrink-0">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Raw View */}
            {activeTab === 'raw' && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <pre className="p-4 bg-gray-50 dark:bg-gray-900 text-sm font-mono text-gray-800 dark:text-gray-200 overflow-x-auto max-h-96">
                  {filteredEntries.map(e => e.raw).join('\n')}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </ToolWrapper>
  )
}

export default LogParserTool
