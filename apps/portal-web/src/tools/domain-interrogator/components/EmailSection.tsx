import type { MailInfo } from '../types'

interface EmailSectionProps {
  mail?: MailInfo
}

export function EmailSection({ mail }: EmailSectionProps) {
  if (!mail) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        Email configuration not available
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* MX Records */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          MX Records
        </h4>
        {mail.mx_records.length > 0 ? (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-1 pr-4 font-medium text-gray-600 dark:text-gray-400">
                  Priority
                </th>
                <th className="text-left py-1 font-medium text-gray-600 dark:text-gray-400">
                  Server
                </th>
              </tr>
            </thead>
            <tbody>
              {mail.mx_records.map((mx, idx) => (
                <tr
                  key={idx}
                  className="border-b border-gray-100 dark:border-gray-800"
                >
                  <td className="py-1 pr-4 text-gray-600 dark:text-gray-400">
                    {mx.preference}
                  </td>
                  <td className="py-1 font-mono text-gray-900 dark:text-white">
                    {mx.exchange}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-gray-500 dark:text-gray-400">
            No MX records found
          </div>
        )}
      </div>

      {/* SPF */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          SPF
        </h4>
        {mail.spf?.exists ? (
          <div className="space-y-2">
            <div className="text-xs font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded break-all">
              {mail.spf.record}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Lookups: {mail.spf.lookup_count}/10
              </span>
              {mail.spf.all_mechanism && (
                <span
                  className={`px-2 py-0.5 text-xs rounded ${
                    mail.spf.all_mechanism === '+all'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : mail.spf.all_mechanism === '-all'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                  }`}
                >
                  {mail.spf.all_mechanism}
                </span>
              )}
            </div>
            {mail.spf.warnings.length > 0 && (
              <div className="space-y-1">
                {mail.spf.warnings.map((warning, idx) => (
                  <div
                    key={idx}
                    className="text-sm text-yellow-600 dark:text-yellow-400"
                  >
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-500 dark:text-gray-400">
            No SPF record found
          </div>
        )}
      </div>

      {/* DMARC */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          DMARC
        </h4>
        {mail.dmarc?.exists ? (
          <div className="space-y-2">
            <div className="text-xs font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded break-all">
              {mail.dmarc.record}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Policy:{' '}
                <span
                  className={`font-medium ${
                    mail.dmarc.policy === 'reject'
                      ? 'text-green-600 dark:text-green-400'
                      : mail.dmarc.policy === 'quarantine'
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {mail.dmarc.policy}
                </span>
              </span>
              {mail.dmarc.pct < 100 && (
                <span className="text-gray-600 dark:text-gray-400">
                  pct={mail.dmarc.pct}%
                </span>
              )}
            </div>
            {mail.dmarc.rua.length > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Reports: {mail.dmarc.rua.join(', ')}
              </div>
            )}
            {mail.dmarc.warnings.length > 0 && (
              <div className="space-y-1">
                {mail.dmarc.warnings.map((warning, idx) => (
                  <div
                    key={idx}
                    className="text-sm text-yellow-600 dark:text-yellow-400"
                  >
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-500 dark:text-gray-400">
            No DMARC record found
          </div>
        )}
      </div>

      {/* MTA-STS */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          MTA-STS
        </h4>
        {mail.mta_sts?.exists ? (
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Mode:</span>
              <span
                className={`font-medium ${
                  mail.mta_sts.mode === 'enforce'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-yellow-600 dark:text-yellow-400'
                }`}
              >
                {mail.mta_sts.mode}
              </span>
            </div>
            {mail.mta_sts.mx_hosts.length > 0 && (
              <div className="text-gray-600 dark:text-gray-400">
                MX Hosts: {mail.mta_sts.mx_hosts.join(', ')}
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-500 dark:text-gray-400">
            MTA-STS not configured
          </div>
        )}
      </div>

      {/* TLS-RPT */}
      {mail.tls_rpt && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            TLS-RPT
          </h4>
          <div className="text-xs font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded break-all">
            {mail.tls_rpt}
          </div>
        </div>
      )}

      {/* Error */}
      {mail.error && (
        <div className="text-sm text-red-600 dark:text-red-400">
          {mail.error}
        </div>
      )}
    </div>
  )
}
