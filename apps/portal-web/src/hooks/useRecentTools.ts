import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'recent-tools'
const MAX_RECENT = 5

export function useRecentTools() {
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentIds))
  }, [recentIds])

  const addRecent = useCallback((toolId: string) => {
    setRecentIds((prev) => {
      const filtered = prev.filter((id) => id !== toolId)
      return [toolId, ...filtered].slice(0, MAX_RECENT)
    })
  }, [])

  return { recentIds, addRecent }
}
