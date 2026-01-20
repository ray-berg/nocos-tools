import type { InfrastructureTrust, PtrStatus, SmtpTlsStatus } from '../types'
import { ChecklistItem } from './ChecklistItem'

interface InfraSectionProps {
  infrastructure?: InfrastructureTrust
}

function getPtrCheckStatus(status: PtrStatus): 'pass' | 'warn' | 'fail' {
  switch (status) {
    case 'aligned':
      return 'pass'
    case 'exists_mismatched':
      return 'warn'
    case 'missing':
      return 'fail'
  }
}

function getTlsCheckStatus(status: SmtpTlsStatus): 'pass' | 'warn' | 'fail' | 'unknown' {
  switch (status) {
    case 'modern':
      return 'pass'
    case 'degraded':
      return 'warn'
    case 'absent':
      return 'fail'
    case 'unknown':
      return 'unknown'
  }
}

export function InfraSection({ infrastructure }: InfraSectionProps) {
  if (!infrastructure) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        Infrastructure data not available
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* PTR / FCrDNS */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Reverse DNS (PTR) & FCrDNS
        </h4>
        {infrastructure.ptr ? (
          <div className="space-y-2">
            <ChecklistItem
              status={getPtrCheckStatus(infrastructure.ptr.status)}
              label="PTR Record"
              value={
                infrastructure.ptr.ptr_hostname
                  ? infrastructure.ptr.ptr_hostname
                  : infrastructure.ptr.status
              }
            />
            {infrastructure.ptr.ptr_hostname && (
              <div className="ml-8 text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  FCrDNS:{' '}
                  <span
                    className={
                      infrastructure.ptr.fcrdns_valid
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }
                  >
                    {infrastructure.ptr.fcrdns_valid ? 'Valid' : 'Invalid'}
                  </span>
                </span>
                {infrastructure.ptr.forward_ips.length > 0 && (
                  <span className="text-gray-500 dark:text-gray-400 ml-2">
                    ({infrastructure.ptr.forward_ips.join(', ')})
                  </span>
                )}
              </div>
            )}
            {infrastructure.ptr.issues.length > 0 && (
              <div className="ml-8 space-y-1">
                {infrastructure.ptr.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="text-sm text-yellow-600 dark:text-yellow-400"
                  >
                    {issue}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-500 dark:text-gray-400 ml-8">
            No sending IP provided - PTR check skipped
          </div>
        )}
      </div>

      {/* HELO Consistency */}
      {infrastructure.helo_consistent !== null &&
        infrastructure.helo_consistent !== undefined && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              HELO/EHLO Consistency
            </h4>
            <ChecklistItem
              status={infrastructure.helo_consistent ? 'pass' : 'warn'}
              label="HELO matches PTR"
              value={infrastructure.helo_consistent ? 'Consistent' : 'Mismatch'}
            />
          </div>
        )}

      {/* SMTP TLS */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          SMTP TLS (STARTTLS)
        </h4>
        {infrastructure.smtp_tls ? (
          <div className="space-y-2">
            <ChecklistItem
              status={getTlsCheckStatus(infrastructure.smtp_tls.status)}
              label="STARTTLS Support"
              value={
                infrastructure.smtp_tls.starttls_supported
                  ? 'Supported'
                  : infrastructure.smtp_tls.status
              }
            />
            {infrastructure.smtp_tls.mx_host && (
              <div className="ml-8 text-sm text-gray-600 dark:text-gray-400">
                Tested MX: {infrastructure.smtp_tls.mx_host}
              </div>
            )}
            {infrastructure.smtp_tls.starttls_supported && (
              <div className="ml-8 flex flex-wrap items-center gap-4 text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Certificate:{' '}
                  <span
                    className={
                      infrastructure.smtp_tls.certificate_valid
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }
                  >
                    {infrastructure.smtp_tls.certificate_valid ? 'Valid' : 'Invalid'}
                  </span>
                </span>
                {infrastructure.smtp_tls.tls_version && (
                  <span className="text-gray-500 dark:text-gray-400">
                    {infrastructure.smtp_tls.tls_version}
                  </span>
                )}
              </div>
            )}
            {infrastructure.smtp_tls.issues.length > 0 && (
              <div className="ml-8 space-y-1">
                {infrastructure.smtp_tls.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="text-sm text-yellow-600 dark:text-yellow-400"
                  >
                    {issue}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-500 dark:text-gray-400 ml-8">
            SMTP TLS not checked
          </div>
        )}
      </div>
    </div>
  )
}
