import { useEffect } from 'react'
import { useRecentTools } from '@/hooks/useRecentTools'
import type { ToolMetadata } from '@/types/tool'

interface ToolWrapperProps {
  metadata: ToolMetadata
  children: React.ReactNode
}

export function ToolWrapper({ metadata, children }: ToolWrapperProps) {
  const { addRecent } = useRecentTools()

  useEffect(() => {
    addRecent(metadata.id)
  }, [metadata.id, addRecent])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{metadata.name}</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">{metadata.description}</p>
        <div className="mt-2 flex gap-2">
          {metadata.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {children}
      </div>
    </div>
  )
}
