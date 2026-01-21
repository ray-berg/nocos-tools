import { useState, useMemo } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'

export const metadata: ToolMetadata = {
  id: 'csv-inspector',
  name: 'CSV Inspector',
  description: 'Parse, analyze, and convert CSV data',
  category: 'Data',
  nav_order: 50,
  tags: ['csv', 'data', 'table', 'convert', 'json', 'parse'],
  has_backend: false,
}

interface ParsedCSV {
  headers: string[]
  rows: string[][]
  rowCount: number
  columnCount: number
}

function parseCSV(text: string, delimiter: string): ParsedCSV | null {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length === 0) return null

  const parseRow = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"' && inQuotes && nextChar === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseRow(lines[0])
  const rows = lines.slice(1).filter(line => line.trim()).map(parseRow)

  return {
    headers,
    rows,
    rowCount: rows.length,
    columnCount: headers.length,
  }
}

export function CsvInspectorTool() {
  const [input, setInput] = useState('')
  const [delimiter, setDelimiter] = useState(',')
  const [page, setPage] = useState(0)
  const [copied, setCopied] = useState(false)
  const pageSize = 25

  const parsed = useMemo(() => {
    if (!input.trim()) return null
    return parseCSV(input, delimiter)
  }, [input, delimiter])

  const paginatedRows = useMemo(() => {
    if (!parsed) return []
    const start = page * pageSize
    return parsed.rows.slice(start, start + pageSize)
  }, [parsed, page])

  const totalPages = parsed ? Math.ceil(parsed.rows.length / pageSize) : 0

  const toJSON = () => {
    if (!parsed) return ''
    const result = parsed.rows.map(row => {
      const obj: Record<string, string> = {}
      parsed.headers.forEach((header, i) => {
        obj[header || `column${i + 1}`] = row[i] || ''
      })
      return obj
    })
    return JSON.stringify(result, null, 2)
  }

  const copyAsJSON = async () => {
    const json = toJSON()
    if (json) {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const loadSample = () => {
    setInput(`name,age,city,email
John Doe,32,New York,john@example.com
Jane Smith,28,Los Angeles,jane@example.com
Bob Johnson,45,Chicago,bob@example.com
Alice Brown,36,Houston,alice@example.com
Charlie Wilson,29,Phoenix,charlie@example.com`)
    setDelimiter(',')
  }

  return (
    <ToolWrapper metadata={metadata}>
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Delimiter
            </label>
            <select
              value={delimiter}
              onChange={e => setDelimiter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value=",">Comma (,)</option>
              <option value="	">Tab</option>
              <option value=";">Semicolon (;)</option>
              <option value="|">Pipe (|)</option>
            </select>
          </div>

          <button
            onClick={loadSample}
            className="px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Load sample
          </button>

          {parsed && (
            <button
              onClick={copyAsJSON}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {copied ? 'Copied!' : 'Copy as JSON'}
            </button>
          )}
        </div>

        {/* Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            CSV Data
          </label>
          <textarea
            value={input}
            onChange={e => { setInput(e.target.value); setPage(0) }}
            placeholder="Paste your CSV data here..."
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Stats */}
        {parsed && (
          <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400">
            <span>{parsed.rowCount} rows</span>
            <span>{parsed.columnCount} columns</span>
            <span>{parsed.headers.filter(h => h).length} named columns</span>
          </div>
        )}

        {/* Table */}
        {parsed && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium w-12">#</th>
                    {parsed.headers.map((header, i) => (
                      <th key={i} className="px-3 py-2 text-left text-gray-700 dark:text-gray-300 font-medium">
                        {header || <span className="text-gray-400">column{i + 1}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedRows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-3 py-2 text-gray-400">{page * pageSize + rowIdx + 1}</td>
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="px-3 py-2 text-gray-900 dark:text-gray-100 max-w-xs truncate">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </ToolWrapper>
  )
}

export default CsvInspectorTool
