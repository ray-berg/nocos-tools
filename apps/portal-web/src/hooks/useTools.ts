import { useEffect, useState } from 'react'
import type { ToolMetadata } from '@/types/tool'

interface UseToolsResult {
  tools: ToolMetadata[]
  loading: boolean
  error: string | null
}

export function useTools(): UseToolsResult {
  const [tools, setTools] = useState<ToolMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/tools')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setTools(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return { tools, loading, error }
}
