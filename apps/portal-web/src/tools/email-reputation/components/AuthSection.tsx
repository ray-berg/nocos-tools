import type { AuthPosture, SpfStatus, DkimStatus, DmarcStatus } from '../types'
import { ChecklistItem } from './ChecklistItem'

interface AuthSectionProps {
  auth?: AuthPosture
}

function getSpfCheckStatus(status: SpfStatus): 'pass' | 'warn' | 'fail' {
  switch (status) {
    case 'passable':
      return 'pass'
    case 'fragile':
      return 'warn'
    case 'broken':
      return 'fail'
  }
}

function getDkimCheckStatus(status: DkimStatus): 'pass' | 'warn' | 'unknown' {
  switch (status) {
    case 'present':
      return 'pass'
    case 'likely_present':
      return 'warn'
    case 'unknown':
      return 'unknown'
  }
}

function getDmarcCheckStatus(status: DmarcStatus): 'pass' | 'warn' | 'fail' {
  switch (status) {
    case 'strict':
      return 'pass'
    case 'enforcing':
      return 'pass'
    case 'monitoring':
      return 'warn'
    case 'absent':
      return 'fail'
  }
}

export function AuthSection({ auth }: AuthSectionProps) {
  if (!auth) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        Authentication data not available
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* SPF */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          SPF (Sender Policy Framework)
        </h4>
        {auth.spf ? (
          <div className="space-y-2">
            <ChecklistItem
              status={getSpfCheckStatus(auth.spf.status)}
              label="SPF Record"
              value={auth.spf.exists ? auth.spf.status : 'Not found'}
            />
            {auth.spf.record && (
              <div className="text-xs font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded break-all ml-8">
                {auth.spf.record}
              </div>
            )}
            <div className="ml-8 flex items-center gap-4 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                DNS Lookups: {auth.spf.lookup_count}/10
              </span>
              {auth.spf.all_mechanism && (
                <span
                  className={`px-2 py-0.5 text-xs rounded ${
                    auth.spf.all_mechanism === '+all'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : auth.spf.all_mechanism === '-all'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                  }`}
                >
                  {auth.spf.all_mechanism}
                </span>
              )}
            </div>
            {auth.spf.issues.length > 0 && (
              <div className="ml-8 space-y-1">
                {auth.spf.issues.map((issue, idx) => (
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
            SPF not checked
          </div>
        )}
      </div>

      {/* DKIM */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          DKIM (DomainKeys Identified Mail)
        </h4>
        {auth.dkim ? (
          <div className="space-y-2">
            <ChecklistItem
              status={getDkimCheckStatus(auth.dkim.status)}
              label="DKIM Selectors"
              value={
                auth.dkim.selectors_found.length > 0
                  ? `${auth.dkim.selectors_found.length} found`
                  : auth.dkim.status
              }
            />
            {auth.dkim.selectors_found.length > 0 && (
              <div className="ml-8 space-y-1">
                {auth.dkim.selectors_found.map((sel, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                  >
                    <span className="font-mono">{sel.selector}</span>
                    {sel.key_bits && (
                      <span
                        className={`px-1.5 py-0.5 text-xs rounded ${
                          sel.weak_key
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {sel.key_bits}-bit
                      </span>
                    )}
                    {sel.weak_key && (
                      <span className="text-yellow-600 dark:text-yellow-400 text-xs">
                        (weak)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {auth.dkim.issues.length > 0 && (
              <div className="ml-8 space-y-1">
                {auth.dkim.issues.map((issue, idx) => (
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
            DKIM not checked
          </div>
        )}
      </div>

      {/* DMARC */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          DMARC (Domain-based Message Authentication)
        </h4>
        {auth.dmarc ? (
          <div className="space-y-2">
            <ChecklistItem
              status={getDmarcCheckStatus(auth.dmarc.status)}
              label="DMARC Policy"
              value={auth.dmarc.exists ? auth.dmarc.policy || 'none' : 'Not found'}
            />
            {auth.dmarc.record && (
              <div className="text-xs font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded break-all ml-8">
                {auth.dmarc.record}
              </div>
            )}
            {auth.dmarc.exists && (
              <div className="ml-8 flex flex-wrap items-center gap-4 text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Policy:{' '}
                  <span
                    className={`font-medium ${
                      auth.dmarc.policy === 'reject'
                        ? 'text-green-600 dark:text-green-400'
                        : auth.dmarc.policy === 'quarantine'
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {auth.dmarc.policy}
                  </span>
                </span>
                {auth.dmarc.pct < 100 && (
                  <span className="text-gray-600 dark:text-gray-400">
                    pct={auth.dmarc.pct}%
                  </span>
                )}
                {auth.dmarc.alignment_dkim && (
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    DKIM: {auth.dmarc.alignment_dkim === 's' ? 'strict' : 'relaxed'}
                  </span>
                )}
                {auth.dmarc.alignment_spf && (
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    SPF: {auth.dmarc.alignment_spf === 's' ? 'strict' : 'relaxed'}
                  </span>
                )}
              </div>
            )}
            {auth.dmarc.rua.length > 0 && (
              <div className="ml-8 text-sm text-gray-600 dark:text-gray-400">
                Reports: {auth.dmarc.rua.join(', ')}
              </div>
            )}
            {auth.dmarc.issues.length > 0 && (
              <div className="ml-8 space-y-1">
                {auth.dmarc.issues.map((issue, idx) => (
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
            DMARC not checked
          </div>
        )}
      </div>
    </div>
  )
}
