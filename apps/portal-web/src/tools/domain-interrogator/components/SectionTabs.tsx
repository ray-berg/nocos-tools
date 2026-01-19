interface SectionTabsProps {
  activeTab: string
  onTabChange: (tab: string) => void
  tabs: { id: string; label: string; count?: number }[]
}

export function SectionTabs({ activeTab, onTabChange, tabs }: SectionTabsProps) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
      <nav className="flex flex-wrap gap-1 -mb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
              ${
                activeTab === tab.id
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-b-2 border-primary-500'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
              }
            `}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
