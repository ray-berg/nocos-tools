import type { RiskInfo, RiskLevel } from '../types'

interface RiskSummaryProps {
  risk?: RiskInfo
}

const riskColors: Record<RiskLevel, { bg: string; text: string; border: string }> = {
  low: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-200',
    border: 'border-green-200 dark:border-green-800',
  },
  medium: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-200',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  medium_high: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-800 dark:text-orange-200',
    border: 'border-orange-200 dark:border-orange-800',
  },
  high: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-200',
    border: 'border-red-200 dark:border-red-800',
  },
  critical: {
    bg: 'bg-red-200 dark:bg-red-900/50',
    text: 'text-red-900 dark:text-red-100',
    border: 'border-red-300 dark:border-red-700',
  },
}

const riskLabels: Record<RiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  medium_high: 'Medium-High Risk',
  high: 'High Risk',
  critical: 'Critical Risk',
}

export function RiskSummary({ risk }: RiskSummaryProps) {
  if (!risk) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        Risk assessment not available
      </div>
    )
  }

  const colors = riskColors[risk.overall_risk]

  return (
    <div className="space-y-4">
      {/* Risk Level Badge */}
      <div className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-lg font-bold ${colors.text}`}>
              {riskLabels[risk.overall_risk]}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Risk Score: {risk.score} / 100+
            </p>
          </div>
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center ${colors.bg} border-4 ${colors.border}`}
          >
            <span className={`text-2xl font-bold ${colors.text}`}>{risk.score}</span>
          </div>
        </div>
      </div>

      {/* Likely Failure Modes */}
      {risk.likely_failure_modes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Likely Failure Modes
          </h4>
          <ul className="space-y-1">
            {risk.likely_failure_modes.map((mode, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300"
              >
                <span className="text-red-500 mt-0.5">&#x2022;</span>
                {mode}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Can Rule Out */}
      {risk.can_rule_out.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            What This Tool Can Rule Out
          </h4>
          <ul className="space-y-1">
            {risk.can_rule_out.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-green-700 dark:text-green-300"
              >
                <span className="text-green-500 mt-0.5">&#x2713;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cannot Determine */}
      {risk.cannot_determine.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Cannot Determine
          </h4>
          <ul className="space-y-1">
            {risk.cannot_determine.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
              >
                <span className="text-gray-400 mt-0.5">?</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
        Email delivery is probabilistic and policy-driven. This tool reports risk
        signals, not definitive blocks.
      </p>
    </div>
  )
}
