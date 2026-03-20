// Test fixtures — synthetic data only, did:exo:test-* namespace, no real PII
import type { Decision } from '../lib/types'

export const mockDecisionDraft: Decision = {
  id: 'dec-test-001',
  tenantId: 'exochain-test',
  status: 'Created',
  title: 'Test Budget Approval 2026',
  decisionClass: 'Operational',
  author: 'did:exo:test-alice',
  createdAt: 1742400000000,
  constitutionVersion: '1',
  votes: [],
  challenges: [],
  transitionLog: [],
  isTerminal: false,
  validNextStatuses: ['Deliberation', 'Void'],
}

export const mockDecisionVoting: Decision = {
  ...mockDecisionDraft,
  id: 'dec-test-002',
  status: 'Voting',
  votes: [
    { voter: 'did:exo:test-alice', choice: 'Approve', rationale: 'Sound proposal', signerType: 'Governor', timestamp: 1742400001000 },
    { voter: 'did:exo:test-bob', choice: 'Reject', rationale: 'Needs revision', signerType: 'Governor', timestamp: 1742400002000 },
  ],
  validNextStatuses: ['Approved', 'Rejected', 'Contested'],
}

export const mockDecisionApproved: Decision = {
  ...mockDecisionDraft,
  id: 'dec-test-003',
  status: 'Approved',
  isTerminal: true,
  validNextStatuses: [],
}

export const mockDecisionConstitutional: Decision = {
  ...mockDecisionDraft,
  id: 'dec-test-004',
  status: 'Created',
  title: 'Amend Article 7 — ExistentialSafeguard Test',
  decisionClass: 'Constitutional',
  validNextStatuses: ['Deliberation', 'Void'],
}

export const mockDecisionContested: Decision = {
  ...mockDecisionDraft,
  id: 'dec-test-005',
  status: 'Contested',
  challenges: [{ id: 'chal-001', grounds: 'ProcedureViolation', status: 'Filed' }],
  validNextStatuses: ['Deliberation', 'Void'],
}
