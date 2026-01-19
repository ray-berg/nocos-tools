import { useState, useMemo } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'

export const metadata: ToolMetadata = {
  id: 'text-diff',
  name: 'Text Diff & Cleanup',
  description: 'Compare two text blocks and apply common cleanup operations',
  category: 'Text',
  nav_order: 10,
  tags: ['diff', 'text', 'cleanup', 'compare'],
  has_backend: false,
}

type DiffLine = {
  type: 'added' | 'removed' | 'unchanged'
  content: string
  lineNum?: number
}

function computeDiff(textA: string, textB: string): DiffLine[] {
  const linesA = textA.split('\n')
  const linesB = textB.split('\n')

  // Simple LCS-based diff
  const m = linesA.length
  const n = linesB.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to build diff
  let i = m,
    j = n
  const result: DiffLine[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      result.unshift({ type: 'unchanged', content: linesA[i - 1], lineNum: i })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', content: linesB[j - 1] })
      j--
    } else {
      result.unshift({ type: 'removed', content: linesA[i - 1], lineNum: i })
      i--
    }
  }

  return result
}

function trimTrailingWhitespace(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
}

function normalizeLF(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function removeDuplicateBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n')
}

export function TextDiffTool() {
  const [textA, setTextA] = useState('')
  const [textB, setTextB] = useState('')
  const [showDiff, setShowDiff] = useState(false)

  const diff = useMemo(() => {
    if (!showDiff) return []
    return computeDiff(textA, textB)
  }, [textA, textB, showDiff])

  const applyCleanup = (fn: (text: string) => string, target: 'A' | 'B' | 'both') => {
    if (target === 'A' || target === 'both') setTextA(fn(textA))
    if (target === 'B' || target === 'both') setTextB(fn(textB))
  }

  return (
    <ToolWrapper metadata={metadata}>
      <div className="space-y-4">
        {/* Cleanup buttons */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Apply to both:</span>
          <button
            onClick={() => applyCleanup(trimTrailingWhitespace, 'both')}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300"
          >
            Trim Trailing Whitespace
          </button>
          <button
            onClick={() => applyCleanup(normalizeLF, 'both')}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300"
          >
            Normalize Line Endings (LF)
          </button>
          <button
            onClick={() => applyCleanup(removeDuplicateBlankLines, 'both')}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300"
          >
            Remove Duplicate Blank Lines
          </button>
        </div>

        {/* Text areas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Text A
            </label>
            <textarea
              value={textA}
              onChange={(e) => setTextA(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm resize-y"
              placeholder="Enter first text..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Text B
            </label>
            <textarea
              value={textB}
              onChange={(e) => setTextB(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm resize-y"
              placeholder="Enter second text..."
            />
          </div>
        </div>

        {/* Diff toggle */}
        <div>
          <button
            onClick={() => setShowDiff(!showDiff)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
          >
            {showDiff ? 'Hide Diff' : 'Show Diff'}
          </button>
        </div>

        {/* Diff output */}
        {showDiff && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Diff Output
              </span>
              <span className="ml-4 text-xs text-gray-500">
                <span className="text-green-600 dark:text-green-400">+ Added</span>
                {' / '}
                <span className="text-red-600 dark:text-red-400">- Removed</span>
              </span>
            </div>
            <div className="max-h-96 overflow-auto">
              {diff.length === 0 ? (
                <div className="px-4 py-2 text-gray-500 dark:text-gray-400 text-sm">
                  No differences found (or both texts are empty)
                </div>
              ) : (
                <pre className="text-sm font-mono">
                  {diff.map((line, i) => (
                    <div
                      key={i}
                      className={`px-4 py-0.5 ${
                        line.type === 'added'
                          ? 'diff-added'
                          : line.type === 'removed'
                            ? 'diff-removed'
                            : 'diff-unchanged'
                      }`}
                    >
                      <span className="select-none mr-2">
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                      </span>
                      {line.content || ' '}
                    </div>
                  ))}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </ToolWrapper>
  )
}

export default TextDiffTool
