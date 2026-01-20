import type { DnsblInfo } from '../types'
import { ChecklistItem } from './ChecklistItem'

interface ReputationSectionProps {
  reputation?: DnsblInfo
}

export function ReputationSection({ reputation }: ReputationSectionProps) {
  if (!reputation) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        Reputation data not available
      </div>
    )
  }

  const hasIpListings = reputation.ip_listings.length > 0
  const hasDomainListings = reputation.domain_listings.length > 0

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div
        className={`p-3 rounded-lg ${
          reputation.total_listings > 0
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
        }`}
      >
        <p
          className={`text-sm font-medium ${
            reputation.total_listings > 0
              ? 'text-red-700 dark:text-red-300'
              : 'text-green-700 dark:text-green-300'
          }`}
        >
          {reputation.total_listings > 0
            ? `Listed on ${reputation.total_listings} blocklist(s)`
            : 'Not listed on any checked blocklists'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Note: Absence from blocklists does not equal good reputation
        </p>
      </div>

      {/* IP Blocklists */}
      {hasIpListings && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            IP Blocklists
          </h4>
          <div className="space-y-1">
            {reputation.ip_listings.map((listing, idx) => (
              <ChecklistItem
                key={idx}
                status={listing.listed ? 'fail' : 'pass'}
                label={listing.zone}
                value={listing.listed ? 'Listed' : 'Not listed'}
                details={listing.listed ? listing.meaning : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Domain Blocklists */}
      {hasDomainListings && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Domain Blocklists
          </h4>
          <div className="space-y-1">
            {reputation.domain_listings.map((listing, idx) => (
              <ChecklistItem
                key={idx}
                status={listing.listed ? 'fail' : 'pass'}
                label={listing.zone}
                value={listing.listed ? 'Listed' : 'Not listed'}
                details={listing.listed ? listing.meaning : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Issues */}
      {reputation.issues.length > 0 && (
        <div className="space-y-1">
          {reputation.issues.map((issue, idx) => (
            <div key={idx} className="text-sm text-red-600 dark:text-red-400">
              {issue}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
