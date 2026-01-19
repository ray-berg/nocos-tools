import type { IpIntelInfo } from '../types'

interface IpIntelSectionProps {
  ipIntel?: IpIntelInfo
}

export function IpIntelSection({ ipIntel }: IpIntelSectionProps) {
  if (!ipIntel) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        IP intelligence not available
      </div>
    )
  }

  if (ipIntel.records.length === 0) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        {ipIntel.error || 'No IP records found'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">
                IP
              </th>
              <th className="text-left py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">
                Location
              </th>
              <th className="text-left py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">
                Organization
              </th>
              <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">
                ASN
              </th>
            </tr>
          </thead>
          <tbody>
            {ipIntel.records.map((record, idx) => (
              <tr
                key={idx}
                className="border-b border-gray-100 dark:border-gray-800"
              >
                <td className="py-2 pr-4">
                  <div className="font-mono text-gray-900 dark:text-white">
                    {record.ip}
                  </div>
                  {record.hostname && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {record.hostname}
                    </div>
                  )}
                  {record.is_anycast && (
                    <span className="mt-1 inline-block px-1.5 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                      Anycast
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                  {[record.city, record.region, record.country]
                    .filter(Boolean)
                    .join(', ') || '-'}
                </td>
                <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                  {record.org || record.isp || '-'}
                </td>
                <td className="py-2 font-mono text-gray-700 dark:text-gray-300">
                  {record.asn || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Error */}
      {ipIntel.error && (
        <div className="text-sm text-red-600 dark:text-red-400">
          {ipIntel.error}
        </div>
      )}
    </div>
  )
}
