import type { BehavioralInfo, BehavioralRisk } from '../types'

interface BehavioralSectionProps {
  behavioral?: BehavioralInfo
}

const riskColors: Record<BehavioralRisk, { bg: string; text: string }> = {
  low: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
  },
  medium: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-300',
  },
  elevated: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
  },
}

const riskLabels: Record<BehavioralRisk, string> = {
  low: 'Low',
  medium: 'Medium',
  elevated: 'Elevated',
}

export function BehavioralSection({ behavioral }: BehavioralSectionProps) {
  if (!behavioral) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        Behavioral analysis not available
      </div>
    )
  }

  const colors = riskColors[behavioral.risk]

  return (
    <div className="space-y-6">
      {/* Risk Level */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Behavioral Risk Level
        </h4>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text}`}>
          {riskLabels[behavioral.risk]}
        </span>
      </div>

      {/* Domain Age */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Domain Age
        </h4>
        {behavioral.domain_age_days !== null && behavioral.domain_age_days !== undefined ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {behavioral.domain_age_days}
              </span>
              <span className="text-gray-500 dark:text-gray-400">days old</span>
            </div>
            {behavioral.is_new_domain && (
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                  New Domain
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  Domains less than 90 days old are often flagged by filters
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-500 dark:text-gray-400">
            Could not determine domain age
          </div>
        )}
      </div>

      {/* Issues */}
      {behavioral.issues.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes
          </h4>
          <ul className="space-y-1">
            {behavioral.issues.map((issue, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
              >
                <span className="text-gray-400 mt-0.5">&#x2022;</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Behavioral indicators are heuristics based on domain registration data. New
        domains may require additional warm-up time for optimal deliverability.
      </p>
    </div>
  )
}
