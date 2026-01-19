import { useState } from 'react'
import type { DomainReport } from '../types'

interface CopyJsonButtonProps {
  report: DomainReport
}

export function CopyJsonButton({ report }: CopyJsonButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy JSON'}
    </button>
  )
}
