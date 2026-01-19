import type { DnsInfo } from '../types'

interface DnsSectionProps {
  dns?: DnsInfo
}

export function DnsSection({ dns }: DnsSectionProps) {
  if (!dns) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        DNS information not available
      </div>
    )
  }

  // Group records by type
  const recordsByType = dns.records.reduce(
    (acc, record) => {
      if (!acc[record.type]) {
        acc[record.type] = []
      }
      acc[record.type].push(record)
      return acc
    },
    {} as Record<string, typeof dns.records>
  )

  const recordTypes = Object.keys(recordsByType).sort()

  return (
    <div className="space-y-6">
      {/* Delegation Info */}
      {dns.delegation && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Delegation
          </h4>
          {dns.delegation.is_lame && (
            <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
              Lame delegation detected for:{' '}
              {dns.delegation.lame_ns.join(', ')}
            </div>
          )}
          <div className="space-y-2">
            {dns.delegation.nameservers.map((ns, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="font-mono text-sm text-gray-900 dark:text-white">
                  {ns}
                </span>
                {dns.delegation?.ns_ips[ns] && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({dns.delegation.ns_ips[ns].join(', ')})
                  </span>
                )}
                {dns.delegation?.lame_ns.includes(ns) && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                    lame
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DNS Records Table */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Records
        </h4>
        {recordTypes.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400">
            No DNS records found
          </div>
        ) : (
          <div className="space-y-4">
            {recordTypes.map((type) => (
              <div key={type}>
                <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  {type} Records
                </h5>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-1 pr-4 font-medium text-gray-600 dark:text-gray-400">
                          Name
                        </th>
                        <th className="text-left py-1 pr-4 font-medium text-gray-600 dark:text-gray-400">
                          TTL
                        </th>
                        <th className="text-left py-1 font-medium text-gray-600 dark:text-gray-400">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recordsByType[type].map((record, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-gray-100 dark:border-gray-800"
                        >
                          <td className="py-1 pr-4 font-mono text-gray-900 dark:text-white">
                            {record.name}
                          </td>
                          <td className="py-1 pr-4 text-gray-600 dark:text-gray-400">
                            {record.ttl}s
                          </td>
                          <td className="py-1 font-mono text-gray-900 dark:text-white break-all">
                            {record.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {dns.error && (
        <div className="text-sm text-red-600 dark:text-red-400">
          {dns.error}
        </div>
      )}
    </div>
  )
}
