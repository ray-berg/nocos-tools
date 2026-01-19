import type { DomainReport } from '../types'

interface SummaryCardProps {
  report: DomainReport
}

export function SummaryCard({ report }: SummaryCardProps) {
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'text-green-600 dark:text-green-400'
      case 'B':
        return 'text-lime-600 dark:text-lime-400'
      case 'C':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'D':
        return 'text-orange-600 dark:text-orange-400'
      default:
        return 'text-red-600 dark:text-red-400'
    }
  }

  const getGradeBg = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'bg-green-100 dark:bg-green-900/30'
      case 'B':
        return 'bg-lime-100 dark:bg-lime-900/30'
      case 'C':
        return 'bg-yellow-100 dark:bg-yellow-900/30'
      case 'D':
        return 'bg-orange-100 dark:bg-orange-900/30'
      default:
        return 'bg-red-100 dark:bg-red-900/30'
    }
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* Risk Score */}
      <div
        className={`p-4 rounded-lg ${getGradeBg(report.risk?.grade || 'F')}`}
      >
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          Risk Score
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-3xl font-bold ${getGradeColor(report.risk?.grade || 'F')}`}
          >
            {report.risk?.grade || '?'}
          </span>
          <span className="text-lg text-gray-600 dark:text-gray-400">
            {report.risk?.score ?? '?'}/100
          </span>
        </div>
      </div>

      {/* DNS Status */}
      <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          DNS Records
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {report.dns?.records.length ?? 0}
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {report.dns?.delegation?.is_lame ? '(lame)' : ''}
          </span>
        </div>
      </div>

      {/* Email Status */}
      <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          Email
        </div>
        <div className="flex flex-wrap gap-1">
          {report.mail?.mx_records && report.mail.mx_records.length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              MX
            </span>
          )}
          {report.mail?.spf?.exists && (
            <span className="px-2 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
              SPF
            </span>
          )}
          {report.mail?.dmarc?.exists && (
            <span className="px-2 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
              DMARC
            </span>
          )}
          {!report.mail?.mx_records?.length &&
            !report.mail?.spf?.exists &&
            !report.mail?.dmarc?.exists && (
              <span className="text-sm text-gray-500">None</span>
            )}
        </div>
      </div>

      {/* Web Status */}
      <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Web</div>
        <div className="flex flex-wrap gap-1">
          {report.web?.https_reachable && (
            <span className="px-2 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
              HTTPS
            </span>
          )}
          {report.web?.hsts_enabled && (
            <span className="px-2 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              HSTS
            </span>
          )}
          {report.web?.tls_cert && !report.web.tls_cert.is_expired && (
            <span className="px-2 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
              Valid Cert
            </span>
          )}
          {!report.web?.https_reachable && (
            <span className="text-sm text-gray-500">No HTTPS</span>
          )}
        </div>
      </div>
    </div>
  )
}
