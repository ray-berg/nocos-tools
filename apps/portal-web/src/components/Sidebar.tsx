import { NavLink } from 'react-router-dom'
import type { ToolMetadata } from '@/types/tool'

interface SidebarProps {
  tools: ToolMetadata[]
  loading: boolean
}

export function Sidebar({ tools, loading }: SidebarProps) {
  // Group tools by category
  const grouped = tools.reduce(
    (acc, tool) => {
      if (!acc[tool.category]) acc[tool.category] = []
      acc[tool.category].push(tool)
      return acc
    },
    {} as Record<string, ToolMetadata[]>
  )

  const categories = Object.keys(grouped).sort()

  return (
    <aside className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 fixed left-0 top-14 bottom-0 overflow-y-auto">
      <nav className="p-4">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `block px-3 py-2 rounded-lg mb-2 text-sm font-medium ${
              isActive
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`
          }
        >
          Home
        </NavLink>

        {loading ? (
          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Loading...</div>
        ) : (
          categories.map((category) => (
            <div key={category} className="mt-4">
              <h3 className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {category}
              </h3>
              <ul className="mt-2 space-y-1">
                {grouped[category].map((tool) => (
                  <li key={tool.id}>
                    <NavLink
                      to={`/tools/${tool.id}`}
                      className={({ isActive }) =>
                        `block px-3 py-2 rounded-lg text-sm ${
                          isActive
                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`
                      }
                    >
                      {tool.name}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </nav>
    </aside>
  )
}
