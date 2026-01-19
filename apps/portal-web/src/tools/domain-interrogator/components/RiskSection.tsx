import type { RiskInfo, RiskSeverity } from '../types'

interface RiskSectionProps {
  risk?: RiskInfo
}

export function RiskSection({ risk }: RiskSectionProps) {
  if (!risk) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        Risk assessment not available
      </div>
    )
  }

  const getSeverityColor = (severity: RiskSeverity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
      case 'high':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800'
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
      case 'low':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
    }
  }

  const getSeverityLabel = (severity: RiskSeverity) => {
    return severity.charAt(0).toUpperCase() + severity.slice(1)
  }

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

  // Group flags by severity
  const flagsBySeverity = risk.flags.reduce(
    (acc, flag) => {
      if (!acc[flag.severity]) {
        acc[flag.severity] = []
      }
      acc[flag.severity].push(flag)
      return acc
    },
    {} as Record<RiskSeverity, typeof risk.flags>
  )

  const severityOrder: RiskSeverity[] = ['critical', 'high', 'medium', 'low', 'info']

  return (
    <div className="space-y-6">
      {/* Score */}
      <div className="flex items-center gap-6">
        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Grade</div>
          <div className={`text-5xl font-bold ${getGradeColor(risk.grade)}`}>
            {risk.grade}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Score</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {risk.score}/100
          </div>
        </div>
        <div className="flex-1">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                risk.score >= 75
                  ? 'bg-green-500'
                  : risk.score >= 50
                    ? 'bg-yellow-500'
                    : risk.score >= 25
                      ? 'bg-orange-500'
                      : 'bg-red-500'
              }`}
              style={{ width: `${risk.score}%` }}
            />
          </div>
        </div>
      </div>

      {/* Flags */}
      {risk.flags.length > 0 ? (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Risk Flags ({risk.flags.length})
          </h4>
          {severityOrder.map((severity) => {
            const flags = flagsBySeverity[severity]
            if (!flags || flags.length === 0) return null

            return (
              <div key={severity} className="space-y-2">
                <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {getSeverityLabel(severity)}
                </h5>
                {flags.map((flag, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${getSeverityColor(flag.severity)}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-medium opacity-75">
                          {flag.category}
                        </span>
                        <p className="text-sm">{flag.message}</p>
                      </div>
                      {flag.points_deducted > 0 && (
                        <span className="text-xs opacity-75">
                          -{flag.points_deducted}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-green-600 dark:text-green-400">
          No risk flags detected
        </div>
      )}
    </div>
  )
}
