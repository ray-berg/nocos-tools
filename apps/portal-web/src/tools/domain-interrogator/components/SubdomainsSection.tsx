import { useState } from 'react'
import type { SubdomainInfo } from '../types'

interface SubdomainsSectionProps {
  subdomains?: SubdomainInfo
}

export function SubdomainsSection({ subdomains }: SubdomainsSectionProps) {
  const [filter, setFilter] = useState('')
  const [showAll, setShowAll] = useState(false)

  if (!subdomains) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        Subdomain information not available
      </div>
    )
  }

  if (subdomains.subdomains.length === 0) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        {subdomains.error || 'No subdomains found in Certificate Transparency logs'}
      </div>
    )
  }

  const filteredSubdomains = filter
    ? subdomains.subdomains.filter((s) =>
        s.toLowerCase().includes(filter.toLowerCase())
      )
    : subdomains.subdomains

  const displayedSubdomains = showAll
    ? filteredSubdomains
    : filteredSubdomains.slice(0, 50)

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <span>
          Found: <strong>{subdomains.total_found}</strong> subdomains
        </span>
        {subdomains.truncated && (
          <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
            Results truncated
          </span>
        )}
      </div>

      {/* Filter */}
      <div>
        <input
          type="text"
          placeholder="Filter subdomains..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Subdomain List */}
      <div className="max-h-96 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
          {displayedSubdomains.map((subdomain, idx) => (
            <div
              key={idx}
              className="px-2 py-1 text-sm font-mono text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 rounded truncate"
              title={subdomain}
            >
              {subdomain}
            </div>
          ))}
        </div>
      </div>

      {/* Show More */}
      {!showAll && filteredSubdomains.length > 50 && (
        <button
          onClick={() => setShowAll(true)}
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          Show all {filteredSubdomains.length} subdomains
        </button>
      )}

      {/* Error */}
      {subdomains.error && (
        <div className="text-sm text-red-600 dark:text-red-400">
          {subdomains.error}
        </div>
      )}
    </div>
  )
}
