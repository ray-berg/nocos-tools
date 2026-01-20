import { useState, useMemo } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'

export const metadata: ToolMetadata = {
  id: 'cron-explainer',
  name: 'Cron Expression Explainer',
  description: 'Parse cron expressions and see next execution times',
  category: 'Developer',
  nav_order: 42,
  tags: ['cron', 'schedule', 'time', 'job', 'automation'],
  has_backend: false,
}

interface CronField {
  name: string
  min: number
  max: number
  names?: string[]
}

const CRON_FIELDS: CronField[] = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12, names: ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
  { name: 'day of week', min: 0, max: 6, names: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
]

const PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Every day at noon', value: '0 12 * * *' },
  { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
  { label: 'Every weekday at 9 AM', value: '0 9 * * 1-5' },
  { label: 'Every Sunday at 3 AM', value: '0 3 * * 0' },
  { label: 'First of every month', value: '0 0 1 * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
]

function parseField(field: string, fieldDef: CronField): number[] | null {
  const values: Set<number> = new Set()

  // Handle wildcards
  if (field === '*') {
    for (let i = fieldDef.min; i <= fieldDef.max; i++) {
      values.add(i)
    }
    return Array.from(values).sort((a, b) => a - b)
  }

  // Split by comma for multiple values
  const parts = field.split(',')

  for (const part of parts) {
    // Handle step values (*/5, 1-10/2)
    const stepMatch = part.match(/^(.+)\/(\d+)$/)
    if (stepMatch) {
      const [, range, stepStr] = stepMatch
      const step = parseInt(stepStr, 10)

      let start = fieldDef.min
      let end = fieldDef.max

      if (range !== '*') {
        const rangeMatch = range.match(/^(\d+)-(\d+)$/)
        if (rangeMatch) {
          start = parseInt(rangeMatch[1], 10)
          end = parseInt(rangeMatch[2], 10)
        } else {
          start = parseInt(range, 10)
          end = fieldDef.max
        }
      }

      for (let i = start; i <= end; i += step) {
        if (i >= fieldDef.min && i <= fieldDef.max) {
          values.add(i)
        }
      }
      continue
    }

    // Handle ranges (1-5)
    const rangeMatch = part.match(/^(\d+)-(\d+)$/)
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10)
      const end = parseInt(rangeMatch[2], 10)
      for (let i = start; i <= end; i++) {
        if (i >= fieldDef.min && i <= fieldDef.max) {
          values.add(i)
        }
      }
      continue
    }

    // Handle named values (for months and days of week)
    if (fieldDef.names) {
      const idx = fieldDef.names.findIndex(
        n => n.toLowerCase() === part.toLowerCase()
      )
      if (idx >= 0) {
        values.add(idx)
        continue
      }
    }

    // Handle single value
    const num = parseInt(part, 10)
    if (!isNaN(num) && num >= fieldDef.min && num <= fieldDef.max) {
      values.add(num)
    } else {
      return null // Invalid value
    }
  }

  return values.size > 0 ? Array.from(values).sort((a, b) => a - b) : null
}

function explainField(values: number[], fieldDef: CronField): string {
  if (values.length === fieldDef.max - fieldDef.min + 1) {
    return `every ${fieldDef.name}`
  }

  if (values.length === 1) {
    const val = values[0]
    if (fieldDef.names) {
      return fieldDef.names[val] || String(val)
    }
    return String(val)
  }

  // Check for step pattern
  if (values.length > 2) {
    const step = values[1] - values[0]
    let isStep = true
    for (let i = 2; i < values.length; i++) {
      if (values[i] - values[i - 1] !== step) {
        isStep = false
        break
      }
    }
    if (isStep && values[0] === fieldDef.min) {
      return `every ${step} ${fieldDef.name}s`
    }
  }

  // Check for range
  let isRange = true
  for (let i = 1; i < values.length; i++) {
    if (values[i] - values[i - 1] !== 1) {
      isRange = false
      break
    }
  }

  if (isRange) {
    if (fieldDef.names) {
      return `${fieldDef.names[values[0]] || values[0]} through ${fieldDef.names[values[values.length - 1]] || values[values.length - 1]}`
    }
    return `${values[0]} through ${values[values.length - 1]}`
  }

  // List values
  if (fieldDef.names) {
    return values.map(v => fieldDef.names![v] || String(v)).join(', ')
  }
  return values.join(', ')
}

function generateExplanation(parsedFields: (number[] | null)[]): string {
  if (parsedFields.some(f => f === null)) {
    return 'Invalid cron expression'
  }

  const fields = parsedFields as number[][]
  const parts: string[] = []

  // Minute
  if (fields[0].length === 60) {
    parts.push('Every minute')
  } else if (fields[0].length === 1) {
    parts.push(`At minute ${fields[0][0]}`)
  } else {
    parts.push(`At minutes ${explainField(fields[0], CRON_FIELDS[0])}`)
  }

  // Hour
  if (fields[1].length < 24) {
    if (fields[1].length === 1) {
      const hour = fields[1][0]
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      parts.push(`at ${hour12}:00 ${ampm}`)
    } else {
      parts.push(`during hours ${explainField(fields[1], CRON_FIELDS[1])}`)
    }
  }

  // Day of month
  if (fields[2].length < 31) {
    parts.push(`on day ${explainField(fields[2], CRON_FIELDS[2])} of the month`)
  }

  // Month
  if (fields[3].length < 12) {
    parts.push(`in ${explainField(fields[3], CRON_FIELDS[3])}`)
  }

  // Day of week
  if (fields[4].length < 7) {
    const dayNames = fields[4].map(d => CRON_FIELDS[4].names![d])
    if (dayNames.length === 5 && !fields[4].includes(0) && !fields[4].includes(6)) {
      parts.push('on weekdays')
    } else if (dayNames.length === 2 && fields[4].includes(0) && fields[4].includes(6)) {
      parts.push('on weekends')
    } else {
      parts.push(`on ${dayNames.join(', ')}`)
    }
  }

  return parts.join(' ')
}

function getNextExecutions(parsedFields: (number[] | null)[], count: number, _timezone: string): Date[] {
  if (parsedFields.some(f => f === null)) {
    return []
  }

  const fields = parsedFields as number[][]
  const dates: Date[] = []
  const now = new Date()
  let current = new Date(now)
  current.setSeconds(0)
  current.setMilliseconds(0)

  const maxIterations = 1000000 // Safety limit
  let iterations = 0

  while (dates.length < count && iterations < maxIterations) {
    iterations++
    current = new Date(current.getTime() + 60000) // Add 1 minute

    const minute = current.getMinutes()
    const hour = current.getHours()
    const dayOfMonth = current.getDate()
    const month = current.getMonth() + 1
    const dayOfWeek = current.getDay()

    if (
      fields[0].includes(minute) &&
      fields[1].includes(hour) &&
      fields[2].includes(dayOfMonth) &&
      fields[3].includes(month) &&
      fields[4].includes(dayOfWeek)
    ) {
      dates.push(new Date(current))
    }
  }

  return dates
}

export function CronExplainerTool() {
  const [expression, setExpression] = useState('0 9 * * 1-5')
  const [timezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [showCount, setShowCount] = useState(10)

  const parsedFields = useMemo(() => {
    const parts = expression.trim().split(/\s+/)
    if (parts.length !== 5) {
      return null
    }
    return parts.map((part, idx) => parseField(part, CRON_FIELDS[idx]))
  }, [expression])

  const explanation = useMemo(() => {
    if (!parsedFields) return 'Invalid cron expression (expected 5 fields)'
    return generateExplanation(parsedFields)
  }, [parsedFields])

  const nextExecutions = useMemo(() => {
    if (!parsedFields) return []
    return getNextExecutions(parsedFields, showCount, timezone)
  }, [parsedFields, showCount, timezone])

  const isValid = parsedFields !== null && !parsedFields.some(f => f === null)

  return (
    <ToolWrapper metadata={metadata}>
      <div className="space-y-6">
        {/* Presets */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Common Presets
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(preset => (
              <button
                key={preset.value}
                onClick={() => setExpression(preset.value)}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  expression === preset.value
                    ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Cron Expression
          </label>
          <input
            type="text"
            value={expression}
            onChange={e => setExpression(e.target.value)}
            placeholder="* * * * *"
            className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              !isValid && expression.trim()
                ? 'border-red-300 dark:border-red-700'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          <div className="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400 font-mono">
            <span>minute</span>
            <span>hour</span>
            <span>day (month)</span>
            <span>month</span>
            <span>day (week)</span>
          </div>
        </div>

        {/* Explanation */}
        <div className={`p-4 rounded-lg ${
          isValid
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}>
          <div className={`text-lg ${
            isValid
              ? 'text-green-800 dark:text-green-300'
              : 'text-red-800 dark:text-red-300'
          }`}>
            {explanation}
          </div>
        </div>

        {/* Field Breakdown */}
        {isValid && parsedFields && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <span className="font-medium text-gray-700 dark:text-gray-300">Field Breakdown</span>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {parsedFields.map((values, idx) => {
                if (!values) return null
                const field = CRON_FIELDS[idx]
                const part = expression.trim().split(/\s+/)[idx]
                return (
                  <div key={idx} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">
                        {field.name}
                      </span>
                      <span className="ml-2 font-mono text-sm text-gray-500 dark:text-gray-400">
                        ({part})
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {explainField(values, field)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Next Executions */}
        {isValid && nextExecutions.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Next {showCount} Executions
              </span>
              <select
                value={showCount}
                onChange={e => setShowCount(Number(e.target.value))}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
              {nextExecutions.map((date, idx) => (
                <div key={idx} className="px-4 py-2 flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">#{idx + 1}</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">
                    {date.toLocaleString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reference */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="font-medium text-gray-700 dark:text-gray-300">Quick Reference</span>
          </div>
          <div className="p-4 text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <code className="text-blue-600 dark:text-blue-400">*</code> - any value
              </div>
              <div>
                <code className="text-blue-600 dark:text-blue-400">,</code> - value list (1,3,5)
              </div>
              <div>
                <code className="text-blue-600 dark:text-blue-400">-</code> - range (1-5)
              </div>
              <div>
                <code className="text-blue-600 dark:text-blue-400">/</code> - step (*/15)
              </div>
            </div>
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
              <strong>Field ranges:</strong> minute (0-59), hour (0-23), day of month (1-31), month (1-12), day of week (0-6, 0=Sunday)
            </div>
          </div>
        </div>
      </div>
    </ToolWrapper>
  )
}

export default CronExplainerTool
