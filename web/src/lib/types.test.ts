import { describe, it, expect } from 'vitest'
import { isTerminalStatus, statusColor, urgencyLevel } from './types'
import type { DecisionStatus } from './types'

describe('isTerminalStatus', () => {
  const terminalStatuses: DecisionStatus[] = ['Approved', 'Rejected', 'Void', 'RatificationExpired']
  const nonTerminalStatuses: DecisionStatus[] = [
    'Created', 'Deliberation', 'Voting', 'Contested', 'RatificationRequired', 'DegradedGovernance',
  ]

  it.each(terminalStatuses)('%s is terminal', (status) => {
    expect(isTerminalStatus(status)).toBe(true)
  })

  it.each(nonTerminalStatuses)('%s is not terminal', (status) => {
    expect(isTerminalStatus(status)).toBe(false)
  })
})

describe('statusColor', () => {
  it('returns a Tailwind color string for every known status', () => {
    const statuses: DecisionStatus[] = [
      'Created', 'Deliberation', 'Voting', 'Approved', 'Rejected', 'Void',
      'Contested', 'RatificationRequired', 'RatificationExpired', 'DegradedGovernance',
    ]
    for (const status of statuses) {
      const color = statusColor(status)
      expect(typeof color).toBe('string')
      expect(color.length).toBeGreaterThan(0)
    }
  })

  it('returns fallback color for unknown status', () => {
    const color = statusColor('UnknownStatus' as DecisionStatus)
    expect(color).toBe('bg-gray-100 text-gray-800')
  })

  it('Approved is green', () => {
    expect(statusColor('Approved')).toContain('green')
  })

  it('Rejected is red', () => {
    expect(statusColor('Rejected')).toContain('red')
  })

  it('Voting is yellow', () => {
    expect(statusColor('Voting')).toContain('yellow')
  })
})

describe('urgencyLevel', () => {
  it('Contested is critical', () => {
    expect(urgencyLevel('Contested')).toBe('critical')
  })

  it('RatificationExpired is critical', () => {
    expect(urgencyLevel('RatificationExpired')).toBe('critical')
  })

  it('Voting is high', () => {
    expect(urgencyLevel('Voting')).toBe('high')
  })

  it('Approved is neutral', () => {
    expect(urgencyLevel('Approved')).toBe('neutral')
  })
})
