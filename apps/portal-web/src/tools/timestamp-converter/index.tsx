import { useState, useEffect, useMemo } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'

export const metadata: ToolMetadata = {
  id: 'timestamp-converter',
  name: 'Unix Timestamp Converter',
  description: 'Convert between Unix timestamps and human-readable dates',
  category: 'Developer',
  nav_order: 43,
  tags: ['timestamp', 'unix', 'epoch', 'date', 'time', 'convert'],
  has_backend: false,
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  const absDiff = Math.abs(diff)
  const isPast = diff < 0

  const seconds = Math.floor(absDiff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  let unit: string
  let value: number

  if (years > 0) {
    unit = years === 1 ? 'year' : 'years'
    value = years
  } else if (months > 0) {
    unit = months === 1 ? 'month' : 'months'
    value = months
  } else if (weeks > 0) {
    unit = weeks === 1 ? 'week' : 'weeks'
    value = weeks
  } else if (days > 0) {
    unit = days === 1 ? 'day' : 'days'
    value = days
  } else if (hours > 0) {
    unit = hours === 1 ? 'hour' : 'hours'
    value = hours
  } else if (minutes > 0) {
    unit = minutes === 1 ? 'minute' : 'minutes'
    value = minutes
  } else {
    unit = seconds === 1 ? 'second' : 'seconds'
    value = seconds
  }

  return isPast ? `${value} ${unit} ago` : `in ${value} ${unit}`
}

export function TimestampConverterTool() {
  const [input, setInput] = useState('')
  const [inputType, setInputType] = useState<'auto' | 'seconds' | 'milliseconds' | 'date'>('auto')
  const [currentTimestamp, setCurrentTimestamp] = useState(Math.floor(Date.now() / 1000))
  const [copied, setCopied] = useState<string | null>(null)

  // Update current timestamp every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimestamp(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const parsedDate = useMemo(() => {
    if (!input.trim()) return null

    const trimmed = input.trim()

    // Detect input type
    let detectedType = inputType
    if (inputType === 'auto') {
      // Check if it looks like a timestamp
      if (/^\d{10}$/.test(trimmed)) {
        detectedType = 'seconds'
      } else if (/^\d{13}$/.test(trimmed)) {
        detectedType = 'milliseconds'
      } else if (/^\d+$/.test(trimmed)) {
        // Ambiguous number
        const num = parseInt(trimmed, 10)
        if (num > 1e12) {
          detectedType = 'milliseconds'
        } else {
          detectedType = 'seconds'
        }
      } else {
        detectedType = 'date'
      }
    }

    try {
      let date: Date

      if (detectedType === 'seconds') {
        date = new Date(parseInt(trimmed, 10) * 1000)
      } else if (detectedType === 'milliseconds') {
        date = new Date(parseInt(trimmed, 10))
      } else {
        date = new Date(trimmed)
      }

      if (isNaN(date.getTime())) {
        return { error: 'Invalid date/timestamp' }
      }

      return { date, detectedType }
    } catch {
      return { error: 'Failed to parse input' }
    }
  }, [input, inputType])

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const setNow = () => {
    setInput(String(Math.floor(Date.now() / 1000)))
    setInputType('seconds')
  }

  const formats = parsedDate?.date ? [
    { label: 'Unix Timestamp (seconds)', value: String(Math.floor(parsedDate.date.getTime() / 1000)) },
    { label: 'Unix Timestamp (milliseconds)', value: String(parsedDate.date.getTime()) },
    { label: 'ISO 8601', value: parsedDate.date.toISOString() },
    { label: 'RFC 2822', value: parsedDate.date.toUTCString() },
    { label: 'Local', value: parsedDate.date.toLocaleString() },
    { label: 'UTC', value: parsedDate.date.toUTCString() },
    { label: 'Date only', value: parsedDate.date.toLocaleDateString() },
    { label: 'Time only', value: parsedDate.date.toLocaleTimeString() },
    { label: 'Relative', value: formatRelativeTime(parsedDate.date) },
  ] : []

  const commonTimezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Singapore',
    'Australia/Sydney',
    'Pacific/Auckland',
  ]

  return (
    <ToolWrapper metadata={metadata}>
      <div className="space-y-6">
        {/* Current Timestamp */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Current Unix Timestamp</div>
          <div className="flex items-center justify-between">
            <div className="font-mono text-2xl text-blue-800 dark:text-blue-200">
              {currentTimestamp}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(String(currentTimestamp), 'current')}
                className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-700"
              >
                {copied === 'current' ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={setNow}
                className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-700"
              >
                Use Now
              </button>
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Input
              </label>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Enter timestamp or date (e.g., 1609459200, 2021-01-01, Jan 1 2021)"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Input Type
              </label>
              <select
                value={inputType}
                onChange={e => setInputType(e.target.value as typeof inputType)}
                className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="auto">Auto-detect</option>
                <option value="seconds">Seconds</option>
                <option value="milliseconds">Milliseconds</option>
                <option value="date">Date String</option>
              </select>
            </div>
          </div>

          {parsedDate?.error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
              {parsedDate.error}
            </div>
          )}

          {parsedDate?.detectedType && inputType === 'auto' && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Detected as: <span className="font-medium">{parsedDate.detectedType}</span>
            </div>
          )}
        </div>

        {/* Converted Formats */}
        {formats.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <span className="font-medium text-gray-700 dark:text-gray-300">Converted Formats</span>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {formats.map(format => (
                <div key={format.label} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{format.label}</div>
                    <div className="font-mono text-gray-900 dark:text-gray-100">{format.value}</div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(format.value, format.label)}
                    className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                  >
                    {copied === format.label ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timezone Display */}
        {parsedDate?.date && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <span className="font-medium text-gray-700 dark:text-gray-300">Time in Different Timezones</span>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto">
              {commonTimezones.map(tz => {
                let formatted: string
                try {
                  formatted = parsedDate.date!.toLocaleString('en-US', {
                    timeZone: tz,
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                  })
                } catch {
                  formatted = 'Invalid timezone'
                }
                return (
                  <div key={tz} className="px-4 py-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400 font-mono">{tz}</span>
                    <span className="text-gray-900 dark:text-gray-100">{formatted}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Quick Reference */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="font-medium text-gray-700 dark:text-gray-300">Quick Reference</span>
          </div>
          <div className="p-4 text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <div><strong>Unix Epoch:</strong> January 1, 1970 00:00:00 UTC</div>
            <div><strong>Seconds:</strong> 10 digits (e.g., 1609459200)</div>
            <div><strong>Milliseconds:</strong> 13 digits (e.g., 1609459200000)</div>
            <div><strong>Supported formats:</strong> ISO 8601, RFC 2822, natural language dates</div>
          </div>
        </div>
      </div>
    </ToolWrapper>
  )
}

export default TimestampConverterTool
