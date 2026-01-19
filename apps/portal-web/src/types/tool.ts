export interface ToolMetadata {
  id: string
  name: string
  description: string
  category: string
  nav_order: number
  tags: string[]
  has_backend: boolean
}

export interface ToolDefinition {
  metadata: ToolMetadata
  component: React.ComponentType
}
