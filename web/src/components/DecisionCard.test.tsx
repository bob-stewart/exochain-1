import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DecisionCard } from './DecisionCard'
import {
  mockDecisionDraft,
  mockDecisionVoting,
  mockDecisionApproved,
  mockDecisionContested,
  mockDecisionConstitutional,
} from '../test/fixtures'

// Wrap in router since DecisionCard uses <Link>
const renderCard = (decision = mockDecisionDraft) =>
  render(
    <MemoryRouter>
      <DecisionCard decision={decision} />
    </MemoryRouter>
  )

describe('DecisionCard', () => {
  it('renders the decision title', () => {
    renderCard()
    expect(screen.getByText('Test Budget Approval 2026')).toBeInTheDocument()
  })

  it('renders the decision class badge', () => {
    renderCard()
    expect(screen.getByText('Operational')).toBeInTheDocument()
  })

  it('shows "Begin Deliberation" action for Draft status', () => {
    renderCard(mockDecisionDraft)
    expect(screen.getByRole('link', { name: /Begin Deliberation/i })).toBeInTheDocument()
  })

  it('shows "Cast Vote" action for Voting status', () => {
    renderCard(mockDecisionVoting)
    expect(screen.getByRole('link', { name: /Cast Vote/i })).toBeInTheDocument()
  })

  it('shows "Finalized" (no action) for terminal Approved decision', () => {
    renderCard(mockDecisionApproved)
    expect(screen.getByText('Finalized')).toBeInTheDocument()
    // No action link should be present
    expect(screen.queryByRole('link', { name: /Cast Vote|Begin|Advance|Ratify/i })).not.toBeInTheDocument()
  })

  it('shows "Review Challenge" action for Contested status', () => {
    renderCard(mockDecisionContested)
    expect(screen.getByRole('link', { name: /Review Challenge/i })).toBeInTheDocument()
  })

  it('renders Constitutional class badge for ExistentialSafeguard decisions', () => {
    renderCard(mockDecisionConstitutional)
    expect(screen.getByText('Constitutional')).toBeInTheDocument()
  })

  it('shows vote counts for voting decision', () => {
    renderCard(mockDecisionVoting)
    expect(screen.getByText('1 approve')).toBeInTheDocument()
    expect(screen.getByText('1 reject')).toBeInTheDocument()
  })

  it('shows vote progress bar for Voting status with votes', () => {
    const { container } = renderCard(mockDecisionVoting)
    const meter = container.querySelector('[role="meter"]')
    expect(meter).toBeInTheDocument()
  })

  it('does not show vote bar for Draft with no votes', () => {
    const { container } = renderCard(mockDecisionDraft)
    const meter = container.querySelector('[role="meter"]')
    expect(meter).not.toBeInTheDocument()
  })

  it('shows challenge indicator when challenges present', () => {
    renderCard(mockDecisionContested)
    expect(screen.getByText('1 challenge')).toBeInTheDocument()
  })

  it('renders author DID in shortened form (strips did:exo: prefix)', () => {
    renderCard()
    expect(screen.getByText('test-alice')).toBeInTheDocument()
  })

  it('renders a link to the decision detail page', () => {
    renderCard()
    const detailLink = screen.getByRole('link', { name: /View decision/i })
    expect(detailLink).toHaveAttribute('href', '/decisions/dec-test-001')
  })

  it('is accessible: has article role with aria-labelledby', () => {
    const { container } = renderCard()
    const article = container.querySelector('article')
    expect(article).toBeInTheDocument()
    expect(article).toHaveAttribute('aria-labelledby', 'decision-title-dec-test-001')
  })
})
