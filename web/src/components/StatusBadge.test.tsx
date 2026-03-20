import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders the decision status label', () => {
    render(<StatusBadge status="Draft" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Draft')
  })

  it('shows pulsing indicator for non-terminal status', () => {
    const { container } = render(<StatusBadge status="Voting" />)
    const pulse = container.querySelector('.animate-pulse')
    expect(pulse).toBeInTheDocument()
  })

  it('shows lock icon and no pulse for terminal status (Approved)', () => {
    const { container } = render(<StatusBadge status="Approved" />)
    const pulse = container.querySelector('.animate-pulse')
    expect(pulse).not.toBeInTheDocument()
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('shows lock icon for Rejected (terminal)', () => {
    const { container } = render(<StatusBadge status="Rejected" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('has correct aria-label with (final) suffix for terminal status', () => {
    render(<StatusBadge status="Approved" />)
    const badge = screen.getByRole('status')
    expect(badge).toHaveAttribute('aria-label', 'Decision status: Approved (final)')
  })

  it('has correct aria-label without (final) for non-terminal', () => {
    render(<StatusBadge status="Deliberation" />)
    const badge = screen.getByRole('status')
    expect(badge).toHaveAttribute('aria-label', 'Decision status: Deliberation')
  })

  it('renders without verification indicator when showVerification=false', () => {
    const { container } = render(<StatusBadge status="Draft" showVerification={false} />)
    const dot = container.querySelector('.w-2')
    expect(dot).not.toBeInTheDocument()
  })

  it('renders all non-terminal statuses without throwing', () => {
    const statuses = ['Draft', 'Deliberation', 'Voting', 'Contested', 'RatificationRequired', 'DegradedGovernance'] as const
    for (const status of statuses) {
      expect(() => render(<StatusBadge status={status} />)).not.toThrow()
    }
  })

  it('renders all terminal statuses without throwing', () => {
    const statuses = ['Approved', 'Rejected', 'Void', 'RatificationExpired'] as const
    for (const status of statuses) {
      expect(() => render(<StatusBadge status={status} />)).not.toThrow()
    }
  })

  it('formats multi-word status with spaces (RatificationRequired → Ratification Required)', () => {
    render(<StatusBadge status="RatificationRequired" />)
    expect(screen.getByRole('status')).toHaveTextContent('Ratification Required')
  })
})
