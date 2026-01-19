import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { DomainInterrogatorTool, metadata } from '../src/tools/domain-interrogator/index'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Wrapper for router context
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('DomainInterrogatorTool', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('metadata', () => {
    it('has correct id', () => {
      expect(metadata.id).toBe('domain-interrogator')
    })

    it('has correct category', () => {
      expect(metadata.category).toBe('Network')
    })

    it('has backend enabled', () => {
      expect(metadata.has_backend).toBe(true)
    })

    it('has relevant tags', () => {
      expect(metadata.tags).toContain('domain')
      expect(metadata.tags).toContain('dns')
      expect(metadata.tags).toContain('dnssec')
      expect(metadata.tags).toContain('email')
      expect(metadata.tags).toContain('tls')
    })
  })

  describe('rendering', () => {
    it('renders domain input', () => {
      renderWithRouter(<DomainInterrogatorTool />)
      expect(screen.getByPlaceholderText('example.com')).toBeInTheDocument()
    })

    it('renders analyze button', () => {
      renderWithRouter(<DomainInterrogatorTool />)
      expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument()
    })

    it('renders option checkboxes', () => {
      renderWithRouter(<DomainInterrogatorTool />)
      expect(screen.getByLabelText(/web\/tls check/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/dnssec validation/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/ct subdomains/i)).toBeInTheDocument()
    })

    it('checkboxes are checked by default', () => {
      renderWithRouter(<DomainInterrogatorTool />)
      expect(screen.getByLabelText(/web\/tls check/i)).toBeChecked()
      expect(screen.getByLabelText(/dnssec validation/i)).toBeChecked()
      expect(screen.getByLabelText(/ct subdomains/i)).toBeChecked()
    })
  })

  describe('form interaction', () => {
    it('disables button when domain is empty', () => {
      renderWithRouter(<DomainInterrogatorTool />)
      const button = screen.getByRole('button', { name: /analyze/i })
      expect(button).toBeDisabled()
    })

    it('enables button when domain is entered', () => {
      renderWithRouter(<DomainInterrogatorTool />)
      const input = screen.getByPlaceholderText('example.com')
      fireEvent.change(input, { target: { value: 'example.com' } })

      const button = screen.getByRole('button', { name: /analyze/i })
      expect(button).not.toBeDisabled()
    })

    it('can toggle checkboxes', () => {
      renderWithRouter(<DomainInterrogatorTool />)
      const webCheckbox = screen.getByLabelText(/web\/tls check/i)

      expect(webCheckbox).toBeChecked()
      fireEvent.click(webCheckbox)
      expect(webCheckbox).not.toBeChecked()
    })
  })

  describe('API interaction', () => {
    it('calls API with correct data on submit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          domain: 'example.com',
          queried_at: '2024-01-01T00:00:00Z',
          cached: false,
          options: {},
          errors: [],
        }),
      })

      renderWithRouter(<DomainInterrogatorTool />)

      const input = screen.getByPlaceholderText('example.com')
      fireEvent.change(input, { target: { value: 'example.com' } })

      const button = screen.getByRole('button', { name: /analyze/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/tools/domain-interrogator/run',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('example.com'),
          })
        )
      })
    })

    it('shows loading state during request', async () => {
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    domain: 'example.com',
                    queried_at: '2024-01-01T00:00:00Z',
                    cached: false,
                    options: {},
                    errors: [],
                  }),
                }),
              100
            )
          )
      )

      renderWithRouter(<DomainInterrogatorTool />)

      const input = screen.getByPlaceholderText('example.com')
      fireEvent.change(input, { target: { value: 'example.com' } })

      const button = screen.getByRole('button', { name: /analyze/i })
      fireEvent.click(button)

      expect(screen.getByText(/analyzing/i)).toBeInTheDocument()
    })

    it('displays error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Invalid domain' }),
      })

      renderWithRouter(<DomainInterrogatorTool />)

      const input = screen.getByPlaceholderText('example.com')
      fireEvent.change(input, { target: { value: 'invalid' } })

      const button = screen.getByRole('button', { name: /analyze/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText(/invalid domain/i)).toBeInTheDocument()
      })
    })

    it('displays results on successful response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          domain: 'example.com',
          queried_at: '2024-01-01T00:00:00Z',
          cached: false,
          options: { include_web: true, include_ct: true, include_dnssec: true },
          errors: [],
          risk: {
            score: 85,
            grade: 'B',
            flags: [],
          },
        }),
      })

      renderWithRouter(<DomainInterrogatorTool />)

      const input = screen.getByPlaceholderText('example.com')
      fireEvent.change(input, { target: { value: 'example.com' } })

      const button = screen.getByRole('button', { name: /analyze/i })
      fireEvent.click(button)

      await waitFor(() => {
        // Domain, grade, and score appear in both summary card and risk section
        expect(screen.getAllByText('example.com').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('B').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('85/100').length).toBeGreaterThanOrEqual(1)
      })
    })
  })
})
