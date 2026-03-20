import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusIndicator } from './StatusIndicator'
import type { DecisionStatus } from '../lib/types'

describe('StatusIndicator', () => {
  it('renders status label text', () => {
    render(<StatusIndicator status="Voting" />)
    expect(screen.getByText('Voting')).toBeInTheDocument()
  })

  it('has status role with aria-label', () => {
    render(<StatusIndicator status="Approved" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Status: Approved')
  })

  it('formats multi-word statuses correctly', () => {
    render(<StatusIndicator status="RatificationRequired" />)
    expect(screen.getByText('Ratification Required')).toBeInTheDocument()
  })

  it('formats DegradedGovernance correctly', () => {
    render(<StatusIndicator status="DegradedGovernance" />)
    expect(screen.getByText('Degraded Governance')).toBeInTheDocument()
  })

  const statuses: DecisionStatus[] = [
    'Created', 'Deliberation', 'Voting', 'Approved', 'Rejected',
    'Void', 'Contested', 'RatificationRequired', 'RatificationExpired', 'DegradedGovernance',
  ]

  it.each(statuses)('%s renders without throwing', (status) => {
    render(<StatusIndicator status={status} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('accepts sm size prop', () => {
    render(<StatusIndicator status="Voting" size="sm" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('accepts lg size prop', () => {
    render(<StatusIndicator status="Approved" size="lg" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
