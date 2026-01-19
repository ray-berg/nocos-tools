import type { WebInfo } from '../types'

interface WebSectionProps {
  web?: WebInfo
}

export function WebSection({ web }: WebSectionProps) {
  if (!web) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        Web/TLS information not available
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Reachability */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Reachability
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                web.http_reachable
                  ? 'bg-green-500'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              HTTP {web.http_status && `(${web.http_status})`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                web.https_reachable
                  ? 'bg-green-500'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              HTTPS {web.https_status && `(${web.https_status})`}
            </span>
          </div>
          {web.http_redirects_to_https && (
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                HTTP redirects to HTTPS
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Security Headers */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Security
        </h4>
        <div className="flex flex-wrap gap-2">
          {web.hsts_enabled ? (
            <span className="px-2 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
              HSTS Enabled
              {web.hsts_max_age && ` (${Math.floor(web.hsts_max_age / 86400)}d)`}
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
              No HSTS
            </span>
          )}
          {web.tls_version && (
            <span className="px-2 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              {web.tls_version}
            </span>
          )}
        </div>
        {web.server_header && (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Server: {web.server_header}
          </div>
        )}
      </div>

      {/* TLS Certificate */}
      {web.tls_cert && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            TLS Certificate
          </h4>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
            {/* Status badges */}
            <div className="flex flex-wrap gap-2">
              {web.tls_cert.is_expired ? (
                <span className="px-2 py-0.5 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                  EXPIRED
                </span>
              ) : web.tls_cert.is_expiring_soon ? (
                <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                  Expiring Soon ({web.tls_cert.days_until_expiry} days)
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  Valid ({web.tls_cert.days_until_expiry} days)
                </span>
              )}
            </div>

            {/* Certificate details */}
            <dl className="space-y-2">
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Subject
                </dt>
                <dd className="text-sm font-mono text-gray-900 dark:text-white break-all">
                  {web.tls_cert.subject}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Issuer
                </dt>
                <dd className="text-sm font-mono text-gray-900 dark:text-white break-all">
                  {web.tls_cert.issuer}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">
                    Valid From
                  </dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    {web.tls_cert.not_before}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">
                    Valid Until
                  </dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    {web.tls_cert.not_after}
                  </dd>
                </div>
              </div>
              {web.tls_cert.san_domains.length > 0 && (
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">
                    SAN Domains ({web.tls_cert.san_domains.length})
                  </dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {web.tls_cert.san_domains.slice(0, 10).map((domain, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 text-xs font-mono rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        {domain}
                      </span>
                    ))}
                    {web.tls_cert.san_domains.length > 10 && (
                      <span className="text-xs text-gray-500">
                        +{web.tls_cert.san_domains.length - 10} more
                      </span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}

      {/* Error */}
      {web.error && (
        <div className="text-sm text-red-600 dark:text-red-400">{web.error}</div>
      )}
    </div>
  )
}
