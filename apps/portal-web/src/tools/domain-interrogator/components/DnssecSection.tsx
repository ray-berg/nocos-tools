import type { DnssecInfo } from '../types'

interface DnssecSectionProps {
  dnssec?: DnssecInfo
}

export function DnssecSection({ dnssec }: DnssecSectionProps) {
  if (!dnssec) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        DNSSEC information not available
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            DNSSEC:
          </span>
          {dnssec.enabled ? (
            <span className="px-2 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
              Enabled
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              Not Enabled
            </span>
          )}
        </div>

        {dnssec.enabled && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Validation:
            </span>
            {dnssec.valid ? (
              <span className="px-2 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                Valid
              </span>
            ) : (
              <span className="px-2 py-0.5 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                Invalid
              </span>
            )}
          </div>
        )}

        {dnssec.has_rrsig && (
          <span className="px-2 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            RRSIG Present
          </span>
        )}
      </div>

      {/* DS Records */}
      {dnssec.ds_records.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            DS Records
          </h4>
          <ul className="space-y-1">
            {dnssec.ds_records.map((ds, idx) => (
              <li
                key={idx}
                className="text-xs font-mono text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 p-2 rounded break-all"
              >
                {ds}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* DNSKEY Records */}
      {dnssec.dnskey_records.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            DNSKEY Records
          </h4>
          <ul className="space-y-1">
            {dnssec.dnskey_records.map((key, idx) => (
              <li
                key={idx}
                className="text-xs font-mono text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 p-2 rounded"
              >
                {key}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error */}
      {dnssec.error && (
        <div className="text-sm text-red-600 dark:text-red-400">
          {dnssec.error}
        </div>
      )}
    </div>
  )
}
