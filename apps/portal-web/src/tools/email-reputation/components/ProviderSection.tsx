import type { MxInferenceInfo, InferredProvider } from '../types'

interface ProviderSectionProps {
  provider?: MxInferenceInfo
}

const providerLabels: Record<InferredProvider, string> = {
  google: 'Google Workspace / Gmail',
  microsoft: 'Microsoft 365 / Exchange Online',
  proofpoint: 'Proofpoint',
  mimecast: 'Mimecast',
  barracuda: 'Barracuda',
  cisco: 'Cisco Email Security',
  other: 'Unknown / Other',
}

export function ProviderSection({ provider }: ProviderSectionProps) {
  if (!provider) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        Provider analysis not available
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* MX Records */}
      {provider.mx_records.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            MX Records
          </h4>
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
              {provider.mx_records.map((mx, idx) => (
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
        </div>
      )}

      {/* Inferred Provider */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Detected Provider
        </h4>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              provider.inferred_provider === 'other'
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            }`}
          >
            {providerLabels[provider.inferred_provider]}
          </span>
        </div>
      </div>

      {/* Sensitivity Profile */}
      {provider.sensitivity && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Provider Sensitivity Profile
          </h4>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    provider.sensitivity.dkim_strict
                      ? 'bg-yellow-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
                <span className="text-gray-600 dark:text-gray-400">
                  DKIM Strict: {provider.sensitivity.dkim_strict ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    provider.sensitivity.dmarc_strict
                      ? 'bg-yellow-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
                <span className="text-gray-600 dark:text-gray-400">
                  DMARC Strict: {provider.sensitivity.dmarc_strict ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    provider.sensitivity.anti_spoofing
                      ? 'bg-yellow-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
                <span className="text-gray-600 dark:text-gray-400">
                  Anti-Spoofing: {provider.sensitivity.anti_spoofing ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    provider.sensitivity.impersonation_detection
                      ? 'bg-yellow-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
                <span className="text-gray-600 dark:text-gray-400">
                  Impersonation Detection:{' '}
                  {provider.sensitivity.impersonation_detection ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
            {provider.sensitivity.notes && (
              <p className="text-sm text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                {provider.sensitivity.notes}
              </p>
            )}
          </div>
        </div>
      )}

      {provider.inferred_provider !== 'other' && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          This analysis is based on MX record patterns and may not reflect custom
          configurations.
        </p>
      )}
    </div>
  )
}
