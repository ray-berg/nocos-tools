import type { RdapInfo } from '../types'

interface RdapSectionProps {
  rdap?: RdapInfo
}

export function RdapSection({ rdap }: RdapSectionProps) {
  if (!rdap) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        RDAP information not available
      </div>
    )
  }

  if (rdap.error) {
    return (
      <div className="text-red-600 dark:text-red-400">Error: {rdap.error}</div>
    )
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    try {
      return new Date(dateStr).toLocaleDateString()
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-4">
      {/* Registration Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Registration
          </h4>
          <dl className="space-y-1">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500 dark:text-gray-400">
                Registrar
              </dt>
              <dd className="text-sm text-gray-900 dark:text-white">
                {rdap.registrar || 'N/A'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500 dark:text-gray-400">
                Created
              </dt>
              <dd className="text-sm text-gray-900 dark:text-white">
                {formatDate(rdap.creation_date)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500 dark:text-gray-400">
                Expires
              </dt>
              <dd className="text-sm text-gray-900 dark:text-white">
                {formatDate(rdap.expiration_date)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500 dark:text-gray-400">
                Updated
              </dt>
              <dd className="text-sm text-gray-900 dark:text-white">
                {formatDate(rdap.updated_date)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Status */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Status
          </h4>
          {rdap.status.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {rdap.status.map((status, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  {status}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm text-gray-500">No status available</span>
          )}
        </div>
      </div>

      {/* Registrant */}
      {rdap.registrant && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Registrant
          </h4>
          <dl className="space-y-1">
            {rdap.registrant.name && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 dark:text-gray-400">
                  Name
                </dt>
                <dd className="text-sm text-gray-900 dark:text-white">
                  {rdap.registrant.name}
                </dd>
              </div>
            )}
            {rdap.registrant.organization && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 dark:text-gray-400">
                  Organization
                </dt>
                <dd className="text-sm text-gray-900 dark:text-white">
                  {rdap.registrant.organization}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Nameservers */}
      {rdap.nameservers.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Nameservers (from RDAP)
          </h4>
          <ul className="space-y-1">
            {rdap.nameservers.map((ns, idx) => (
              <li
                key={idx}
                className="text-sm font-mono text-gray-900 dark:text-white"
              >
                {ns}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
