import { useState, useMemo } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'

export const metadata: ToolMetadata = {
  id: 'regex-tester',
  name: 'Regex Tester',
  description: 'Test regular expressions with real-time matching and capture group display',
  category: 'Text',
  nav_order: 30,
  tags: ['regex', 'pattern', 'match', 'text'],
  has_backend: false,
}

interface Match {
  index: number
  text: string
  groups: (string | undefined)[]
  namedGroups: Record<string, string>
}

interface RegexResult {
  matches: Match[]
  error: string | null
}

function testRegex(pattern: string, flags: string, testString: string): RegexResult {
  if (!pattern) {
    return { matches: [], error: null }
  }

  try {
    const regex = new RegExp(pattern, flags)
    const matches: Match[] = []

    if (flags.includes('g')) {
      let match
      let safety = 0
      while ((match = regex.exec(testString)) !== null && safety < 1000) {
        matches.push({
          index: match.index,
          text: match[0],
          groups: match.slice(1),
          namedGroups: match.groups || {},
        })
        // Prevent infinite loop on zero-length matches
        if (match[0].length === 0) {
          regex.lastIndex++
        }
        safety++
      }
    } else {
      const match = regex.exec(testString)
      if (match) {
        matches.push({
          index: match.index,
          text: match[0],
          groups: match.slice(1),
          namedGroups: match.groups || {},
        })
      }
    }

    return { matches, error: null }
  } catch (err) {
    return { matches: [], error: err instanceof Error ? err.message : 'Invalid regex' }
  }
}

const FLAG_OPTIONS = [
  { value: 'g', label: 'global', description: 'Find all matches' },
  { value: 'i', label: 'ignoreCase', description: 'Case-insensitive matching' },
  { value: 'm', label: 'multiline', description: '^ and $ match line boundaries' },
  { value: 's', label: 'dotAll', description: '. matches newlines' },
  { value: 'u', label: 'unicode', description: 'Enable Unicode support' },
]

export function RegexTesterTool() {
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState('g')
  const [testString, setTestString] = useState('')

  const result = useMemo(() => testRegex(pattern, flags, testString), [pattern, flags, testString])

  const toggleFlag = (flag: string) => {
    if (flags.includes(flag)) {
      setFlags(flags.replace(flag, ''))
    } else {
      setFlags(flags + flag)
    }
  }

  // Highlight matches in test string
  const highlightedText = useMemo(() => {
    if (!result.matches.length || result.error) return null

    const parts: { text: string; isMatch: boolean; matchIndex?: number }[] = []
    let lastEnd = 0

    result.matches.forEach((match, i) => {
      if (match.index > lastEnd) {
        parts.push({ text: testString.slice(lastEnd, match.index), isMatch: false })
      }
      parts.push({ text: match.text, isMatch: true, matchIndex: i })
      lastEnd = match.index + match.text.length
    })

    if (lastEnd < testString.length) {
      parts.push({ text: testString.slice(lastEnd), isMatch: false })
    }

    return parts
  }, [result.matches, result.error, testString])

  return (
    <ToolWrapper metadata={metadata}>
      <div className="space-y-6">
        {/* Pattern input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Pattern
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400">/</span>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="[a-z]+|[0-9]+"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
            />
            <span className="text-gray-500 dark:text-gray-400">/</span>
            <span className="font-mono text-gray-700 dark:text-gray-300">{flags}</span>
          </div>
        </div>

        {/* Flags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Flags
          </label>
          <div className="flex flex-wrap gap-2">
            {FLAG_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleFlag(opt.value)}
                className={`px-3 py-1 rounded text-sm ${
                  flags.includes(opt.value)
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                }`}
                title={opt.description}
              >
                {opt.value} ({opt.label})
              </button>
            ))}
          </div>
        </div>

        {/* Test string */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Test String
          </label>
          <textarea
            value={testString}
            onChange={(e) => setTestString(e.target.value)}
            placeholder="Enter text to test against..."
            className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm resize-y"
          />
        </div>

        {/* Error */}
        {result.error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-300 font-mono text-sm">{result.error}</p>
          </div>
        )}

        {/* Highlighted preview */}
        {highlightedText && highlightedText.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Highlighted Matches
            </h3>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg font-mono text-sm whitespace-pre-wrap break-all">
              {highlightedText.map((part, i) =>
                part.isMatch ? (
                  <mark
                    key={i}
                    className="bg-yellow-200 dark:bg-yellow-800 text-gray-900 dark:text-white px-0.5 rounded"
                    title={`Match ${part.matchIndex! + 1}`}
                  >
                    {part.text}
                  </mark>
                ) : (
                  <span key={i} className="text-gray-700 dark:text-gray-300">
                    {part.text}
                  </span>
                )
              )}
            </div>
          </div>
        )}

        {/* Matches */}
        {result.matches.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Matches ({result.matches.length})
            </h3>
            <div className="space-y-3">
              {result.matches.map((match, i) => (
                <div
                  key={i}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Match {i + 1}
                      </span>
                      <div className="font-mono text-gray-900 dark:text-white">
                        "{match.text}"
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Index: {match.index}
                      </span>
                    </div>
                  </div>

                  {match.groups.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Capture Groups
                      </span>
                      <div className="mt-1 space-y-1">
                        {match.groups.map((group, gi) => (
                          <div key={gi} className="flex gap-2 text-sm">
                            <span className="text-gray-500 dark:text-gray-400">${gi + 1}:</span>
                            <span className="font-mono text-gray-900 dark:text-white">
                              {group === undefined ? '(undefined)' : `"${group}"`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(match.namedGroups).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Named Groups</span>
                      <div className="mt-1 space-y-1">
                        {Object.entries(match.namedGroups).map(([name, value]) => (
                          <div key={name} className="flex gap-2 text-sm">
                            <span className="text-gray-500 dark:text-gray-400">{name}:</span>
                            <span className="font-mono text-gray-900 dark:text-white">
                              "{value}"
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {pattern && !result.error && result.matches.length === 0 && testString && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No matches found</p>
        )}
      </div>
    </ToolWrapper>
  )
}

export default RegexTesterTool
