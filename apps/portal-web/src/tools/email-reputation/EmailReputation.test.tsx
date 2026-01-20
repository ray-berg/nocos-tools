import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { EmailReputationTool } from './index'
import type { EmailReputationReport } from './types'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Wrapper component for router context
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe('EmailReputationTool', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('renders the form', () => {
    render(
      <Wrapper>
        <EmailReputationTool />
      </Wrapper>
    )

    expect(screen.getByLabelText(/sending domain/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/sending ip/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument()
  })

  it('disables submit button when domain is empty', () => {
    render(
      <Wrapper>
        <EmailReputationTool />
      </Wrapper>
    )

    const submitButton = screen.getByRole('button', { name: /analyze/i })
    expect(submitButton).toBeDisabled()
  })

  it('enables submit button when domain is entered', () => {
    render(
      <Wrapper>
        <EmailReputationTool />
      </Wrapper>
    )

    const domainInput = screen.getByLabelText(/sending domain/i)
    fireEvent.change(domainInput, { target: { value: 'example.com' } })

    const submitButton = screen.getByRole('button', { name: /analyze/i })
    expect(submitButton).not.toBeDisabled()
  })

  it('shows advanced options when clicked', () => {
    render(
      <Wrapper>
        <EmailReputationTool />
      </Wrapper>
    )

    const advancedButton = screen.getByText(/advanced options/i)
    fireEvent.click(advancedButton)

    expect(screen.getByLabelText(/from address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/helo/i)).toBeInTheDocument()
  })

  it('submits analysis request and displays results', async () => {
    const mockReport: EmailReputationReport = {
      domain: 'example.com',
      queried_at: '2024-01-01T00:00:00Z',
      cached: false,
      options: {},
      risk: {
        overall_risk: 'low',
        score: 10,
        likely_failure_modes: [],
        can_rule_out: ['IP/domain not on major blocklists'],
        cannot_determine: ['Temporary provider throttling'],
      },
      auth: {
        spf: {
          record: 'v=spf1 include:_spf.google.com -all',
          exists: true,
          status: 'passable',
          mechanisms: ['include:_spf.google.com', '-all'],
          lookup_count: 1,
          all_mechanism: '-all',
          has_redirect: false,
          has_multiple_records: false,
          issues: [],
        },
        dkim: {
          status: 'present',
          selectors_found: [{ selector: 'google', key_type: 'rsa', key_bits: 2048, weak_key: false }],
          selectors_checked: ['google', 'selector1'],
          issues: [],
        },
        dmarc: {
          record: 'v=DMARC1; p=reject; rua=mailto:dmarc@example.com',
          exists: true,
          status: 'strict',
          policy: 'reject',
          subdomain_policy: null,
          alignment_dkim: 'r',
          alignment_spf: 'r',
          pct: 100,
          rua: ['mailto:dmarc@example.com'],
          ruf: [],
          issues: [],
        },
      },
      infrastructure: null,
      reputation: {
        ip_listings: [],
        domain_listings: [
          { zone: 'dbl.spamhaus.org', listed: false, return_code: null, meaning: null },
        ],
        total_listings: 0,
        issues: [],
      },
      provider: {
        mx_records: [{ preference: 10, exchange: 'mail.example.com' }],
        inferred_provider: 'other',
        sensitivity: {
          name: 'Unknown / Other',
          dkim_strict: false,
          dmarc_strict: false,
          anti_spoofing: false,
          impersonation_detection: false,
          notes: null,
        },
      },
      behavioral: {
        risk: 'low',
        domain_age_days: 365,
        is_new_domain: false,
        issues: [],
      },
      errors: [],
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockReport,
    })

    render(
      <Wrapper>
        <EmailReputationTool />
      </Wrapper>
    )

    // Enter domain and submit
    const domainInput = screen.getByLabelText(/sending domain/i)
    fireEvent.change(domainInput, { target: { value: 'example.com' } })

    const submitButton = screen.getByRole('button', { name: /analyze/i })
    fireEvent.click(submitButton)

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeInTheDocument()
    })

    // Check risk summary is shown
    expect(screen.getByText(/low risk/i)).toBeInTheDocument()

    // Verify fetch was called correctly
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/tools/email-reputation/run',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })

  it('displays error message on API failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Invalid domain' }),
    })

    render(
      <Wrapper>
        <EmailReputationTool />
      </Wrapper>
    )

    const domainInput = screen.getByLabelText(/sending domain/i)
    fireEvent.change(domainInput, { target: { value: 'bad-domain' } })

    const submitButton = screen.getByRole('button', { name: /analyze/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/invalid domain/i)).toBeInTheDocument()
    })
  })

  it('shows loading state during analysis', async () => {
    // Create a promise that we can resolve manually
    let resolvePromise: (value: unknown) => void
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    mockFetch.mockReturnValueOnce(pendingPromise)

    render(
      <Wrapper>
        <EmailReputationTool />
      </Wrapper>
    )

    const domainInput = screen.getByLabelText(/sending domain/i)
    fireEvent.change(domainInput, { target: { value: 'example.com' } })

    const submitButton = screen.getByRole('button', { name: /analyze/i })
    fireEvent.click(submitButton)

    // Should show loading state
    expect(screen.getByText(/analyzing/i)).toBeInTheDocument()

    // Clean up
    resolvePromise!({
      ok: true,
      json: async () => ({
        domain: 'example.com',
        queried_at: '2024-01-01T00:00:00Z',
        cached: false,
        options: {},
        errors: [],
      }),
    })
  })

  it('includes sending IP in request when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        domain: 'example.com',
        queried_at: '2024-01-01T00:00:00Z',
        cached: false,
        options: { sending_ip: '192.0.2.1' },
        errors: [],
      }),
    })

    render(
      <Wrapper>
        <EmailReputationTool />
      </Wrapper>
    )

    const domainInput = screen.getByLabelText(/sending domain/i)
    fireEvent.change(domainInput, { target: { value: 'example.com' } })

    const ipInput = screen.getByLabelText(/sending ip/i)
    fireEvent.change(ipInput, { target: { value: '192.0.2.1' } })

    const submitButton = screen.getByRole('button', { name: /analyze/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(callBody.sending_ip).toBe('192.0.2.1')
  })

  it('switches between tabs', async () => {
    const mockReport: EmailReputationReport = {
      domain: 'example.com',
      queried_at: '2024-01-01T00:00:00Z',
      cached: false,
      options: {},
      risk: {
        overall_risk: 'low',
        score: 10,
        likely_failure_modes: [],
        can_rule_out: [],
        cannot_determine: [],
      },
      auth: {
        spf: {
          record: 'v=spf1 -all',
          exists: true,
          status: 'passable',
          mechanisms: ['-all'],
          lookup_count: 0,
          all_mechanism: '-all',
          has_redirect: false,
          has_multiple_records: false,
          issues: [],
        },
        dkim: null,
        dmarc: null,
      },
      infrastructure: null,
      reputation: null,
      provider: null,
      behavioral: null,
      errors: [],
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockReport,
    })

    render(
      <Wrapper>
        <EmailReputationTool />
      </Wrapper>
    )

    // Submit form
    const domainInput = screen.getByLabelText(/sending domain/i)
    fireEvent.change(domainInput, { target: { value: 'example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }))

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeInTheDocument()
    })

    // Click on Authentication tab
    const authTab = screen.getByText('Authentication')
    fireEvent.click(authTab)

    // Should show SPF section
    expect(screen.getByText(/spf.*sender policy framework/i)).toBeInTheDocument()
  })
})

describe('metadata', () => {
  it('exports correct metadata', async () => {
    const { metadata } = await import('./index')

    expect(metadata.id).toBe('email-reputation')
    expect(metadata.name).toBe('Email Reputation Analyzer')
    expect(metadata.has_backend).toBe(true)
    expect(metadata.tags).toContain('email')
    expect(metadata.tags).toContain('spf')
    expect(metadata.tags).toContain('dkim')
    expect(metadata.tags).toContain('dmarc')
  })
})
