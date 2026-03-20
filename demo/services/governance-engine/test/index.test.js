// governance-engine unit tests
// Constitutional invariants tested: DualControl, ConflictAdjudication, DelegationGovernance
// Adversarial cases: unauthorized actor, clearance violation, conflict of interest
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/index.js';
import { makeMockPool, loadWasm, invoke, DID, ZERO_HASH } from '../../../test/helpers.js';

const wasm = loadWasm();

// Adversarial WASM stub — rejects clearance
const wasmDenyAll = {
  ...wasm,
  wasm_check_clearance: () => ({ status: 'Denied', reason: 'insufficient_level' }),
  wasm_check_conflicts: () => ({ must_recuse: true, conflicts: [{ type: 'DirectInterest' }] }),
};

describe('governance-engine', () => {
  describe('GET /health', () => {
    it('returns 200 ok', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), { url: '/health' });
      assert.equal(statusCode, 200);
      assert.equal(body.service, 'governance-engine');
    });
  });

  describe('POST /api/quorum/compute — DualControl', () => {
    it('reports quorum_met for 2 approvals (meets threshold)', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/quorum/compute',
        body: { approvals: [DID.alice, DID.bob], policy: { threshold: 2 } },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.quorum_met, true);
    });

    it('reports quorum not met for 0 approvals', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/quorum/compute',
        body: { approvals: [], policy: { threshold: 2 } },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.quorum_met, false);
    });

    it('reports quorum not met for single-actor approval — enforces DualControl', async () => {
      const { body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/quorum/compute',
        body: { approvals: [DID.alice], policy: { threshold: 2 } },
      });
      assert.equal(body.quorum_met, false);
    });
  });

  describe('POST /api/clearance/check', () => {
    it('grants clearance for authorized actor', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/clearance/check',
        body: { actor_did: DID.alice, action: 'approve_decision', policy: { actions: { approve_decision: { required_level: 'Governor' } } } },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.status, 'Granted');
    });

    it('adversarial: denies clearance for insufficient level', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasmDenyAll), {
        method: 'POST', url: '/api/clearance/check',
        body: { actor_did: DID.bob, action: 'ratify_constitution', policy: { actions: { ratify_constitution: { required_level: 'FoundingMember' } } } },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.status, 'Denied');
    });
  });

  describe('POST /api/conflicts/check — ConflictAdjudication', () => {
    it('returns must_recuse: false when no conflicts', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/conflicts/check',
        body: { actor_did: DID.alice, action: { action_id: 'act-001', actor_did: DID.alice, affected_dids: [], description: 'Vote' }, declarations: [] },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.must_recuse, false);
    });

    it('adversarial: forces recusal when direct interest conflict exists', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasmDenyAll), {
        method: 'POST', url: '/api/conflicts/check',
        body: { actor_did: DID.alice, action: { action_id: 'act-002', actor_did: DID.alice, affected_dids: [DID.alice], description: 'Self-vote' }, declarations: [] },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.must_recuse, true);
    });
  });

  describe('POST /api/challenge', () => {
    it('files a governance challenge', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/challenge',
        body: { challenger_did: DID.alice, target_hash: ZERO_HASH, ground: 'ProcedureViolation', evidence: '' },
      });
      assert.equal(statusCode, 200);
      assert.ok(body.challenge_id);
    });
  });

  describe('POST /api/authority/build — DelegationGovernance', () => {
    it('builds authority chain from delegation links', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/authority/build',
        body: { links: [{ delegator: DID.alice, delegatee: DID.bob, scope: 'Vote', expires_at: Date.now() + 86400000 }] },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.valid, true);
      assert.equal(body.depth, 1);
    });

    it('builds empty chain from no links', async () => {
      const { body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/authority/build',
        body: { links: [] },
      });
      assert.equal(body.depth, 0);
    });
  });

  describe('POST /api/evaluate — full pipeline', () => {
    it('evaluates approved when clearance granted and no conflicts', async () => {
      const pool = makeMockPool();
      pool._nextRow({ id_hash: 'dec-001', title: 'Budget', status: 'Voting', decision_class: 'Operational' });
      pool._nextRow({ did: DID.alice, display_name: 'Alice Test', roles: ['Governor'], pace_status: 'Enrolled' });
      pool._nextRows([]); // delegations

      const { statusCode, body } = await invoke(createHandler(pool, wasm), {
        method: 'POST', url: '/api/evaluate',
        body: { decision_id: 'dec-001', actor_did: DID.alice },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.evaluation, 'APPROVED');
    });

    it('returns 404 when decision not found', async () => {
      const pool = makeMockPool();
      pool._nextEmpty(); // decision query returns nothing

      const { statusCode, body } = await invoke(createHandler(pool, wasm), {
        method: 'POST', url: '/api/evaluate',
        body: { decision_id: 'dec-missing', actor_did: DID.alice },
      });
      assert.equal(statusCode, 404);
      assert.ok(body.error.includes('Decision not found'));
    });

    it('returns 404 when actor not found', async () => {
      const pool = makeMockPool();
      pool._nextRow({ id_hash: 'dec-001', title: 'Budget', status: 'Voting', decision_class: 'Operational' });
      pool._nextEmpty(); // actor query returns nothing

      const { statusCode, body } = await invoke(createHandler(pool, wasm), {
        method: 'POST', url: '/api/evaluate',
        body: { decision_id: 'dec-001', actor_did: 'did:exo:test-ghost' },
      });
      assert.equal(statusCode, 404);
      assert.ok(body.error.includes('Actor not found'));
    });

    it('adversarial: evaluates BLOCKED when actor must recuse', async () => {
      const pool = makeMockPool();
      pool._nextRow({ id_hash: 'dec-001', title: 'Budget', status: 'Voting', decision_class: 'Operational' });
      pool._nextRow({ did: DID.alice, display_name: 'Alice Test', roles: ['Governor'], pace_status: 'Enrolled' });
      pool._nextRows([]);

      const { body } = await invoke(createHandler(pool, wasmDenyAll), {
        method: 'POST', url: '/api/evaluate',
        body: { decision_id: 'dec-001', actor_did: DID.alice },
      });
      assert.equal(body.evaluation, 'BLOCKED');
    });
  });

  describe('404 fallthrough', () => {
    it('returns 404 for unknown routes', async () => {
      const { statusCode } = await invoke(createHandler(makeMockPool(), wasm), { url: '/api/unknown' });
      assert.equal(statusCode, 404);
    });
  });
});
