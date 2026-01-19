import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTools } from '@/hooks/useTools'
import { useRecentTools } from '@/hooks/useRecentTools'
import type { ToolMetadata } from '@/types/tool'

export function HomePage() {
  const { tools, loading, error } = useTools()
  const { recentIds } = useRecentTools()
  const [search, setSearch] = useState('')

  const filteredTools = useMemo(() => {
    if (!search.trim()) return tools
    const query = search.toLowerCase()
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some((tag) => tag.toLowerCase().includes(query))
    )
  }, [tools, search])

  const recentTools = useMemo(() => {
    return recentIds
      .map((id) => tools.find((t) => t.id === id))
      .filter((t): t is ToolMetadata => t !== undefined)
  }, [tools, recentIds])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading tools...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-300">Failed to load tools: {error}</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Tools Portal</h1>

      {/* Search */}
      <div className="mb-8">
        <input
          type="text"
          placeholder="Search tools..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Recent Tools */}
      {recentTools.length > 0 && !search && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>
      )}

      {/* All Tools */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {search ? `Search Results (${filteredTools.length})` : 'All Tools'}
        </h2>
        {filteredTools.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No tools found matching "{search}"</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ToolCard({ tool }: { tool: ToolMetadata }) {
  return (
    <Link
      to={`/tools/${tool.id}`}
      className="block p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-500 transition-colors"
    >
      <h3 className="font-medium text-gray-900 dark:text-white">{tool.name}</h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
        {tool.description}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-500">{tool.category}</span>
        {tool.has_backend && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            API
          </span>
        )}
      </div>
    </Link>
  )
}
