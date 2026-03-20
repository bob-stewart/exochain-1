import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UrgencyBadge } from './UrgencyBadge'
import type { UrgencyLevel } from '../lib/types'

describe('UrgencyBadge', () => {
  const levels: UrgencyLevel[] = ['critical', 'high', 'moderate', 'low', 'neutral']

  it.each(levels)('%s renders without throwing', (level) => {
    render(<UrgencyBadge level={level} />)
    const badge = screen.getByRole('status')
    expect(badge).toBeInTheDocument()
  })

  it('uses default label when no label prop given', () => {
    render(<UrgencyBadge level="critical" />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('uses custom label when provided', () => {
    render(<UrgencyBadge level="high" label="Action Required" />)
    expect(screen.getByText('Action Required')).toBeInTheDocument()
  })

  it('has correct aria-label', () => {
    render(<UrgencyBadge level="moderate" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Urgency: Moderate')
  })

  it('custom label reflected in aria-label', () => {
    render(<UrgencyBadge level="low" label="Minor" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Urgency: Minor')
  })
})
