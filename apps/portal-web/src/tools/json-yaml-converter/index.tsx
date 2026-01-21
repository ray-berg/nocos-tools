import { useState, useMemo } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'
import yaml from 'js-yaml'

export const metadata: ToolMetadata = {
  id: 'json-yaml-converter',
  name: 'JSON/YAML Converter',
  description: 'Convert, format, and validate JSON and YAML data',
  category: 'Data',
  nav_order: 47,
  tags: ['json', 'yaml', 'convert', 'format', 'validate', 'data'],
  has_backend: false,
}

type Format = 'json' | 'yaml'
type Operation = 'format' | 'minify' | 'convert'

export function JsonYamlConverterTool() {
  const [input, setInput] = useState('')
  const [inputFormat, setInputFormat] = useState<Format>('json')
  const [outputFormat, setOutputFormat] = useState<Format>('yaml')
  const [operation, setOperation] = useState<Operation>('convert')
  const [indentSize, setIndentSize] = useState(2)
  const [sortKeys, setSortKeys] = useState(false)
  const [copied, setCopied] = useState(false)

  const result = useMemo(() => {
    if (!input.trim()) {
      return { output: '', error: null, parsed: null }
    }

    try {
      // Parse input
      let parsed: unknown
      if (inputFormat === 'json') {
        parsed = JSON.parse(input)
      } else {
        parsed = yaml.load(input)
      }

      // Sort keys if requested
      if (sortKeys && typeof parsed === 'object' && parsed !== null) {
        parsed = sortObjectKeys(parsed)
      }

      // Generate output based on operation
      let output: string
      const targetFormat = operation === 'convert' ? outputFormat : inputFormat

      if (operation === 'minify') {
        if (targetFormat === 'json') {
          output = JSON.stringify(parsed)
        } else {
          output = yaml.dump(parsed, { flowLevel: 0, lineWidth: -1 })
        }
      } else {
        if (targetFormat === 'json') {
          output = JSON.stringify(parsed, null, indentSize)
        } else {
          output = yaml.dump(parsed, { indent: indentSize, lineWidth: -1 })
        }
      }

      return { output, error: null, parsed }
    } catch (e) {
      return {
        output: '',
        error: e instanceof Error ? e.message : 'Invalid input',
        parsed: null,
      }
    }
  }, [input, inputFormat, outputFormat, operation, indentSize, sortKeys])

  const copyToClipboard = async () => {
    if (result.output) {
      await navigator.clipboard.writeText(result.output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const swapFormats = () => {
    const temp = inputFormat
    setInputFormat(outputFormat)
    setOutputFormat(temp)
    if (result.output) {
      setInput(result.output)
    }
  }

  const loadSample = (format: Format) => {
    if (format === 'json') {
      setInput(JSON.stringify({
        name: "Example",
        version: "1.0.0",
        description: "A sample JSON object",
        features: ["feature1", "feature2"],
        config: {
          debug: true,
          maxItems: 100
        }
      }, null, 2))
      setInputFormat('json')
    } else {
      setInput(`name: Example
version: "1.0.0"
description: A sample YAML document
features:
  - feature1
  - feature2
config:
  debug: true
  maxItems: 100`)
      setInputFormat('yaml')
    }
  }

  return (
    <ToolWrapper metadata={metadata}>
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Input Format
            </label>
            <select
              value={inputFormat}
              onChange={e => setInputFormat(e.target.value as Format)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="json">JSON</option>
              <option value="yaml">YAML</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Operation
            </label>
            <select
              value={operation}
              onChange={e => setOperation(e.target.value as Operation)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="convert">Convert</option>
              <option value="format">Format/Prettify</option>
              <option value="minify">Minify</option>
            </select>
          </div>

          {operation === 'convert' && (
            <>
              <button
                onClick={swapFormats}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Swap formats"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </button>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Output Format
                </label>
                <select
                  value={outputFormat}
                  onChange={e => setOutputFormat(e.target.value as Format)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="json">JSON</option>
                  <option value="yaml">YAML</option>
                </select>
              </div>
            </>
          )}

          {operation !== 'minify' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Indent
              </label>
              <select
                value={indentSize}
                onChange={e => setIndentSize(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value={2}>2 spaces</option>
                <option value={4}>4 spaces</option>
                <option value={8}>8 spaces</option>
              </select>
            </div>
          )}

          <label className="inline-flex items-center space-x-2 cursor-pointer pb-2">
            <input
              type="checkbox"
              checked={sortKeys}
              onChange={e => setSortKeys(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Sort keys</span>
          </label>
        </div>

        {/* Sample buttons */}
        <div className="flex gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Load sample:</span>
          <button
            onClick={() => loadSample('json')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            JSON
          </button>
          <button
            onClick={() => loadSample('yaml')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            YAML
          </button>
        </div>

        {/* Input/Output */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Input ({inputFormat.toUpperCase()})
            </label>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`Paste your ${inputFormat.toUpperCase()} here...`}
              rows={16}
              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                result.error
                  ? 'border-red-300 dark:border-red-700'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {result.error && (
              <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                {result.error}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Output ({operation === 'convert' ? outputFormat.toUpperCase() : inputFormat.toUpperCase()})
              </label>
              {result.output && (
                <button
                  onClick={copyToClipboard}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
            <textarea
              value={result.output}
              readOnly
              rows={16}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm"
            />
          </div>
        </div>

        {/* Stats */}
        {result.parsed !== null && (
          <div className="flex gap-6 text-sm text-gray-500 dark:text-gray-400">
            <span>Input: {input.length} chars</span>
            <span>Output: {result.output.length} chars</span>
            {operation === 'minify' && input.length > 0 && (
              <span>
                Reduced by {Math.round((1 - result.output.length / input.length) * 100)}%
              </span>
            )}
          </div>
        )}
      </div>
    </ToolWrapper>
  )
}

function sortObjectKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys)
  }
  if (obj !== null && typeof obj === 'object') {
    const sorted: Record<string, unknown> = {}
    const keys = Object.keys(obj as Record<string, unknown>).sort()
    for (const key of keys) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key])
    }
    return sorted
  }
  return obj
}

export default JsonYamlConverterTool
