import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Sidebar } from '../src/components/Sidebar'
import type { ToolMetadata } from '../src/types/tool'

const mockTools: ToolMetadata[] = [
  {
    id: 'text-diff',
    name: 'Text Diff & Cleanup',
    description: 'Compare two text blocks',
    category: 'Text',
    nav_order: 10,
    tags: ['diff', 'text'],
    has_backend: false,
  },
  {
    id: 'url-inspector',
    name: 'URL Inspector',
    description: 'Parse URLs and fetch HEAD',
    category: 'Network',
    nav_order: 20,
    tags: ['url', 'http'],
    has_backend: true,
  },
  {
    id: 'regex-tester',
    name: 'Regex Tester',
    description: 'Test regex patterns',
    category: 'Text',
    nav_order: 30,
    tags: ['regex'],
    has_backend: false,
  },
]

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state', () => {
    render(
      <BrowserRouter>
        <Sidebar tools={[]} loading={true} />
      </BrowserRouter>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders tools grouped by category', () => {
    render(
      <BrowserRouter>
        <Sidebar tools={mockTools} loading={false} />
      </BrowserRouter>
    )

    // Check categories are rendered
    expect(screen.getByText('Network')).toBeInTheDocument()
    expect(screen.getByText('Text')).toBeInTheDocument()

    // Check tools are rendered
    expect(screen.getByText('Text Diff & Cleanup')).toBeInTheDocument()
    expect(screen.getByText('URL Inspector')).toBeInTheDocument()
    expect(screen.getByText('Regex Tester')).toBeInTheDocument()
  })

  it('renders Home link', () => {
    render(
      <BrowserRouter>
        <Sidebar tools={mockTools} loading={false} />
      </BrowserRouter>
    )

    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('renders tool links with correct paths', () => {
    render(
      <BrowserRouter>
        <Sidebar tools={mockTools} loading={false} />
      </BrowserRouter>
    )

    const textDiffLink = screen.getByText('Text Diff & Cleanup').closest('a')
    expect(textDiffLink).toHaveAttribute('href', '/tools/text-diff')

    const urlInspectorLink = screen.getByText('URL Inspector').closest('a')
    expect(urlInspectorLink).toHaveAttribute('href', '/tools/url-inspector')
  })
})
