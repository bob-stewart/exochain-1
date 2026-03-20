// decision-forge unit tests — covers DecisionObject lifecycle, voting, state machine
// Constitutional invariants tested: DemocraticLegitimacy, ConflictAdjudication, ExistentialSafeguard
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/index.js';
import { makeMockPool, loadWasm, invoke, DID, ZERO_HASH } from '../../../test/helpers.js';

const wasm = loadWasm();

describe('decision-forge', () => {
  describe('GET /health', () => {
    it('returns 200 ok', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), { url: '/health' });
      assert.equal(statusCode, 200);
      assert.equal(body.service, 'decision-forge');
    });
  });

  describe('POST /api/decision/create', () => {
    it('creates an Operational decision in Draft state', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST',
        url: '/api/decision/create',
        body: { title: 'Test Budget Approval', decision_class: 'Operational' },
      });
      assert.equal(statusCode, 201);
      assert.equal(body.title, 'Test Budget Approval');
      assert.equal(body.status, 'Draft');
      assert.ok(body.id, 'should have id');
    });

    it('creates a Constitutional decision — ExistentialSafeguard path', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST',
        url: '/api/decision/create',
        body: { title: 'Amend Article 7', decision_class: 'Constitutional', constitution_hash: ZERO_HASH },
      });
      assert.equal(statusCode, 201);
      assert.equal(body.decision_class, 'Constitutional');
    });
  });

  describe('POST /api/decision/vote — DemocraticLegitimacy', () => {
    it('adds a vote to an existing decision', async () => {
      // First create a decision
      const { body: decision } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST',
        url: '/api/decision/create',
        body: { title: 'Vote Test', decision_class: 'Operational' },
      });

      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST',
        url: '/api/decision/vote',
        body: {
          decision_json: decision,
          vote: { voter: DID.alice, choice: 'Approve', rationale: 'Well reasoned', signature: 'sig-test', timestamp_ms: Date.now() },
        },
      });
      assert.equal(statusCode, 200);
      assert.ok(Array.isArray(body.votes));
      assert.equal(body.votes.length, 1);
      assert.equal(body.votes[0].choice, 'Approve');
    });
  });

  describe('POST /api/decision/evidence', () => {
    it('attaches evidence to a decision', async () => {
      const { body: decision } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/decision/create',
        body: { title: 'Evidence Test', decision_class: 'Operational' },
      });

      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/decision/evidence',
        body: { decision_json: decision, evidence: { type: 'document', hash: ZERO_HASH } },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.evidence.length, 1);
    });
  });

  describe('POST /api/decision/transition — BCTS state machine', () => {
    it('transitions Draft → Deliberation', async () => {
      const { body: decision } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/decision/create',
        body: { title: 'Transition Test', decision_class: 'Operational' },
      });

      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/decision/transition',
        body: { decision_json: decision, to_state: 'Deliberation', actor_did: DID.alice },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.status, 'Deliberation');
      assert.equal(body.transitionLog.length, 1);
    });

    it('transitioning to Closed marks isTerminal = true', async () => {
      const { body: decision } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/decision/create',
        body: { title: 'Terminal Test', decision_class: 'Operational' },
      });

      const { body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/decision/transition',
        body: { decision_json: decision, to_state: 'Closed', actor_did: DID.alice },
      });
      assert.equal(body.isTerminal, true);
    });
  });

  describe('POST /api/decision/hash', () => {
    it('returns a 64-char hex hash for any decision', async () => {
      const { body: decision } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/decision/create',
        body: { title: 'Hash Test', decision_class: 'Operational' },
      });

      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/decision/hash',
        body: { decision_json: decision },
      });
      assert.equal(statusCode, 200);
      assert.equal(typeof body.hash, 'string');
      assert.equal(body.hash.length, 64);
    });
  });

  describe('POST /api/decision/terminal', () => {
    it('returns false for Draft decision', async () => {
      const { body: decision } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/decision/create',
        body: { title: 'Terminal Check', decision_class: 'Operational' },
      });

      const { body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/decision/terminal',
        body: { decision_json: decision },
      });
      assert.equal(body.is_terminal, false);
    });

    it('returns true for Closed decision', async () => {
      const closedDecision = { status: 'Closed', id: 'x', title: 'y', votes: [], evidence: [], challenges: [], transitionLog: [] };
      const { body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/decision/terminal',
        body: { decision_json: closedDecision },
      });
      assert.equal(body.is_terminal, true);
    });
  });

  describe('POST /api/decision/challenge — ConflictAdjudication', () => {
    it('files a governance challenge', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/decision/challenge',
        body: { challenger_did: DID.alice, decision_id: 'dec-001', ground: 'ProcedureViolation', evidence_hash: ZERO_HASH },
      });
      assert.equal(statusCode, 200);
      assert.ok(body.challenge_id);
      assert.equal(body.challenger_did, DID.alice);
    });
  });

  describe('POST /api/decision/accountability', () => {
    it('proposes an accountability action', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/decision/accountability',
        body: { target_did: DID.bob, proposer_did: DID.alice, action_type: 'Censure', reason: 'Breach of fiduciary duty', evidence_hash: ZERO_HASH },
      });
      assert.equal(statusCode, 200);
      assert.ok(body.accountability_id);
    });
  });

  describe('GET /api/workflow/stages', () => {
    it('returns all BCTS workflow stages', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), { url: '/api/workflow/stages' });
      assert.equal(statusCode, 200);
      assert.ok(Array.isArray(body.stages));
      assert.ok(body.stages.includes('Draft'));
      assert.ok(body.stages.includes('Closed'));
    });
  });

  describe('404 fallthrough', () => {
    it('returns 404 for unknown routes', async () => {
      const { statusCode } = await invoke(createHandler(makeMockPool(), wasm), { url: '/api/unknown' });
      assert.equal(statusCode, 404);
    });
  });
});
