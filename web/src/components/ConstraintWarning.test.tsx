import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConstraintWarning } from './ConstraintWarning'

describe('ConstraintWarning', () => {
  it('renders message and constraintId', () => {
    render(<ConstraintWarning constraintId="INV-001" message="Quorum not met" severity="warn" />)
    expect(screen.getByText('Quorum not met')).toBeInTheDocument()
    expect(screen.getByText('Constraint: INV-001')).toBeInTheDocument()
  })

  it('block severity uses alert role and assertive aria-live', () => {
    render(<ConstraintWarning constraintId="INV-002" message="Hard block" severity="block" />)
    const el = screen.getByRole('alert')
    expect(el).toBeInTheDocument()
    expect(el).toHaveAttribute('aria-live', 'assertive')
  })

  it('warn severity uses status role and polite aria-live', () => {
    render(<ConstraintWarning constraintId="INV-003" message="Warning" severity="warn" />)
    const el = screen.getByRole('status')
    expect(el).toBeInTheDocument()
    expect(el).toHaveAttribute('aria-live', 'polite')
  })

  it('info severity uses status role and polite aria-live', () => {
    render(<ConstraintWarning constraintId="INV-004" message="Info" severity="info" />)
    const el = screen.getByRole('status')
    expect(el).toBeInTheDocument()
    expect(el).toHaveAttribute('aria-live', 'polite')
  })
})
