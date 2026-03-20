// gateway-api unit tests — ExoChain orchestrator
// Full governance pipeline: system info, decisions, voting, crypto, backlog, BCTS
// Adversarial cases: non-enrolled author, missing decision, clearance denied, recusal required
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/index.js';
import { makeMockPool, loadWasm, invoke, DID, ZERO_HASH } from '../../../test/helpers.js';

const wasm = loadWasm();

const wasmDenyVote = {
  ...wasm,
  wasm_check_clearance: () => ({ status: 'Denied', reason: 'insufficient_level' }),
};
const wasmForceRecusal = {
  ...wasm,
  wasm_check_clearance: () => ({ status: 'Granted' }),
  wasm_check_conflicts: () => ({ must_recuse: true, conflicts: [{ type: 'DirectInterest' }] }),
};

describe('gateway-api', () => {
  describe('GET /health', () => {
    it('returns 200 with db:connected', async () => {
      const pool = makeMockPool();
      pool._nextRows([{ '?column?': 1 }]); // SELECT 1
      const { statusCode, body } = await invoke(createHandler(pool, wasm), { url: '/health' });
      assert.equal(statusCode, 200);
      assert.equal(body.db, 'connected');
    });
  });

  describe('GET /api/system', () => {
    it('returns 8 constitutional invariants, MCP rules, workflow stages', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), { url: '/api/system' });
      assert.equal(statusCode, 200);
      assert.equal(body.constitutional_invariants.length, 8);
      assert.ok(Array.isArray(body.mcp_rules));
      assert.ok(body.mcp_rules.length > 0);
      assert.ok(Array.isArray(body.workflow_stages));
      assert.ok(body.bcts_draft_transitions.includes('Deliberation'));
    });
  });

  describe('GET /api/users', () => {
    it('returns users list from db', async () => {
      const pool = makeMockPool();
      pool._nextRows([{ did: DID.alice, display_name: 'Alice Test', pace_status: 'Enrolled' }]);
      const { statusCode, body } = await invoke(createHandler(pool, wasm), { url: '/api/users' });
      assert.equal(statusCode, 200);
      assert.ok(Array.isArray(body));
    });
  });

  describe('GET /api/identity/scores', () => {
    it('returns identity scores from db', async () => {
      const pool = makeMockPool();
      pool._nextRows([{ did: DID.alice, score: 90, tier: 'Platinum', display_name: 'Alice Test' }]);
      const { statusCode, body } = await invoke(createHandler(pool, wasm), { url: '/api/identity/scores' });
      assert.equal(statusCode, 200);
      assert.ok(Array.isArray(body));
    });
  });

  describe('GET /api/decisions', () => {
    it('lists decisions from db', async () => {
      const pool = makeMockPool();
      pool._nextRows([{ id_hash: 'dec-001', title: 'Budget 2026', status: 'Draft', decision_class: 'Operational' }]);
      const { statusCode, body } = await invoke(createHandler(pool, wasm), { url: '/api/decisions' });
      assert.equal(statusCode, 200);
      assert.ok(Array.isArray(body));
    });
  });

  describe('POST /api/decisions — create decision pipeline', () => {
    it('creates a decision for an enrolled PACE author', async () => {
      const pool = makeMockPool();
      pool._nextRow({ did: DID.alice, roles: ['Governor'], pace_status: 'Enrolled' });
      pool._nextRow({ version: 1, payload: { name: 'ExoChain Foundation Constitution' } });
      pool._nextEmpty(); // INSERT
      const { statusCode, body } = await invoke(createHandler(pool, wasm), {
        method: 'POST', url: '/api/decisions',
        body: { title: 'New Budget', decision_class: 'Operational', author_did: DID.alice },
      });
      assert.equal(statusCode, 201);
      assert.ok(body.decision.id);
      assert.equal(body.decision.title, 'New Budget');
    });

    it('returns 404 when author DID not found', async () => {
      const pool = makeMockPool();
      pool._nextEmpty(); // no user found
      const { statusCode, body } = await invoke(createHandler(pool, wasm), {
        method: 'POST', url: '/api/decisions',
        body: { title: 'Ghost Decision', decision_class: 'Operational', author_did: 'did:exo:test-ghost' },
      });
      assert.equal(statusCode, 404);
      assert.ok(body.error.includes('Author not found'));
    });

    it('adversarial: returns 403 when author not PACE enrolled', async () => {
      const pool = makeMockPool();
      pool._nextRow({ did: DID.bob, roles: [], pace_status: 'Pending' });
      const { statusCode, body } = await invoke(createHandler(pool, wasm), {
        method: 'POST', url: '/api/decisions',
        body: { title: 'Unauthorized Decision', decision_class: 'Operational', author_did: DID.bob },
      });
      assert.equal(statusCode, 403);
      assert.ok(body.error.includes('PACE enrolled'));
    });
  });

  describe('POST /api/decisions/vote', () => {
    const storedDecision = { id: 'dec-001', title: 'Budget', status: 'Voting', votes: [], evidence: [], challenges: [], transitionLog: [] };

    it('records a vote for an authorized Governor', async () => {
      const pool = makeMockPool();
      pool._nextRow({ payload: storedDecision });
      pool._nextEmpty(); // UPDATE

      const { statusCode, body } = await invoke(createHandler(pool, wasm), {
        method: 'POST', url: '/api/decisions/vote',
        body: { decision_id: 'dec-001', voter_did: DID.alice, choice: 'Approve', rationale: 'Sound proposal' },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.vote_recorded, true);
    });

    it('returns 404 when decision not found', async () => {
      const pool = makeMockPool();
      pool._nextEmpty();
      const { statusCode, body } = await invoke(createHandler(pool, wasm), {
        method: 'POST', url: '/api/decisions/vote',
        body: { decision_id: 'dec-missing', voter_did: DID.alice, choice: 'Approve' },
      });
      assert.equal(statusCode, 404);
    });

    it('adversarial: blocks vote when clearance denied', async () => {
      const pool = makeMockPool();
      pool._nextRow({ payload: storedDecision });
      const { statusCode, body } = await invoke(createHandler(pool, wasmDenyVote), {
        method: 'POST', url: '/api/decisions/vote',
        body: { decision_id: 'dec-001', voter_did: DID.bob, choice: 'Approve' },
      });
      assert.equal(statusCode, 403);
      assert.ok(body.error.includes('clearance'));
    });

    it('adversarial: blocks vote when actor must recuse', async () => {
      const pool = makeMockPool();
      pool._nextRow({ payload: storedDecision });
      const { statusCode, body } = await invoke(createHandler(pool, wasmForceRecusal), {
        method: 'POST', url: '/api/decisions/vote',
        body: { decision_id: 'dec-001', voter_did: DID.alice, choice: 'Approve' },
      });
      assert.equal(statusCode, 403);
      assert.ok(body.error.includes('recuse'));
    });
  });

  describe('POST /api/decisions/transition', () => {
    it('transitions a decision state', async () => {
      const pool = makeMockPool();
      pool._nextRow({ payload: { id: 'dec-001', status: 'Draft', votes: [], evidence: [], challenges: [], transitionLog: [] }, status: 'Draft' });
      pool._nextEmpty(); // UPDATE

      const { statusCode, body } = await invoke(createHandler(pool, wasm), {
        method: 'POST', url: '/api/decisions/transition',
        body: { decision_id: 'dec-001', to_state: 'Deliberation', actor_did: DID.alice },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.new_state, 'Deliberation');
    });

    it('returns 404 when decision not found', async () => {
      const pool = makeMockPool();
      pool._nextEmpty();
      const { statusCode } = await invoke(createHandler(pool, wasm), {
        method: 'POST', url: '/api/decisions/transition',
        body: { decision_id: 'dec-missing', to_state: 'Deliberation', actor_did: DID.alice },
      });
      assert.equal(statusCode, 404);
    });
  });

  describe('POST /api/crypto/hash', () => {
    it('returns a 64-char hex hash', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/crypto/hash',
        body: { data: { key: 'value' } },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.hash.length, 64);
    });
  });

  describe('POST /api/crypto/keypair', () => {
    it('returns public and secret key', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/crypto/keypair', body: {},
      });
      assert.equal(statusCode, 200);
      assert.ok(body.public_key);
      assert.ok(body.secret_key);
    });
  });

  describe('POST /api/crypto/sign + /api/crypto/verify', () => {
    it('sign returns a signature string', async () => {
      const { body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/crypto/sign',
        body: { message: 'hello', secret_key: 'b'.repeat(64) },
      });
      assert.ok(typeof body.signature === 'string');
    });

    it('verify returns valid: true for a correctly signed message', async () => {
      const handler = createHandler(makeMockPool(), wasm);
      // First sign the message to get a valid stub signature
      const { body: signed } = await invoke(handler, {
        method: 'POST', url: '/api/crypto/sign',
        body: { message: 'hello', secret_key: 'b'.repeat(64) },
      });
      // Then verify with the signature produced by the sign step
      const { body } = await invoke(handler, {
        method: 'POST', url: '/api/crypto/verify',
        body: { message: 'hello', signature: signed.signature, public_key: 'a'.repeat(64) },
      });
      assert.equal(body.valid, true);
    });
  });

  describe('GET /api/bcts/transitions', () => {
    it('returns transitions for Draft state', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        url: '/api/bcts/transitions?state=Draft',
      });
      assert.equal(statusCode, 200);
      assert.ok(body.transitions.includes('Deliberation'));
      assert.equal(body.is_terminal, false);
    });

    it('returns empty transitions and is_terminal:true for Closed', async () => {
      const { body } = await invoke(createHandler(makeMockPool(), wasm), {
        url: '/api/bcts/transitions?state=Closed',
      });
      assert.deepEqual(body.transitions, []);
      assert.equal(body.is_terminal, true);
    });
  });

  describe('POST /api/identity/shamir/split', () => {
    it('splits a secret into shares', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/identity/shamir/split',
        body: { secret: 'test-recovery-key', threshold: 2, shares: 3 },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.shares.length, 3);
    });
  });

  describe('ExoForge backlog: feedback → vote → status lifecycle', () => {
    it('ingests feedback and lists it in backlog', async () => {
      const handler = createHandler(makeMockPool(), wasm);

      const { statusCode: s1, body: fb } = await invoke(handler, {
        method: 'POST', url: '/api/feedback',
        body: { widget: 'KanbanBoard', page: 'DashboardPage', type: 'bug', message: 'Cards not draggable on mobile' },
      });
      assert.equal(s1, 201);
      assert.ok(fb.feedback_id);
      assert.equal(fb.status, 'ingested');

      const { body: backlog } = await invoke(handler, { url: '/api/backlog' });
      assert.ok(Array.isArray(backlog));
      assert.ok(backlog.some(i => i.id === fb.feedback_id));
    });

    it('votes on a backlog item and reaches auto-approved disposition at 3 approvals', async () => {
      const handler = createHandler(makeMockPool(), wasm);

      // Ingest an item
      const { body: fb } = await invoke(handler, {
        method: 'POST', url: '/api/feedback',
        body: { widget: 'CouncilAIPanel', page: 'AgentsPage', type: 'enhancement', message: 'Add panel collapse' },
      });

      // 3 panel votes
      for (const panel of ['governance', 'legal', 'architecture']) {
        await invoke(handler, {
          method: 'POST', url: '/api/backlog/vote',
          body: { id: fb.feedback_id, vote: 'approve', panel, rationale: `${panel} approves` },
        });
      }

      const { body: backlog } = await invoke(handler, { url: '/api/backlog' });
      const item = backlog.find(i => i.id === fb.feedback_id);
      assert.equal(item.disposition, 'approved');
    });

    it('updates backlog item status', async () => {
      const handler = createHandler(makeMockPool(), wasm);
      const { body: fb } = await invoke(handler, {
        method: 'POST', url: '/api/feedback',
        body: { widget: 'StatusBadge', page: 'DecisionDetailPage', type: 'bug', message: 'Badge color wrong' },
      });

      const { statusCode, body } = await invoke(handler, {
        method: 'POST', url: '/api/backlog/status',
        body: { id: fb.feedback_id, status: 'in-progress', exoforge_run_id: 'run-abc123' },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.status, 'in-progress');
      assert.equal(body.exoforge_run_id, 'run-abc123');
    });

    it('returns 404 when voting on unknown backlog item', async () => {
      const handler = createHandler(makeMockPool(), wasm);
      // Add one item so backlog isn't empty
      await invoke(handler, {
        method: 'POST', url: '/api/feedback',
        body: { widget: 'test', page: 'test', type: 'bug', message: 'seed' },
      });
      const { statusCode } = await invoke(handler, {
        method: 'POST', url: '/api/backlog/vote',
        body: { id: 'FB-NONEXISTENT', vote: 'approve' },
      });
      assert.equal(statusCode, 404);
    });
  });

  describe('GET /api/delegations', () => {
    it('returns delegations from db', async () => {
      const pool = makeMockPool();
      pool._nextRows([{ id_hash: 'del-001', delegator: DID.alice, delegatee: DID.bob }]);
      const { statusCode, body } = await invoke(createHandler(pool, wasm), { url: '/api/delegations' });
      assert.equal(statusCode, 200);
      assert.ok(Array.isArray(body));
    });
  });

  describe('GET /api/constitution', () => {
    it('returns current constitution', async () => {
      const pool = makeMockPool();
      pool._nextRow({ tenant_id: 'exochain-foundation', version: 1, payload: { name: 'ExoChain Constitution' } });
      const { statusCode, body } = await invoke(createHandler(pool, wasm), { url: '/api/constitution' });
      assert.equal(statusCode, 200);
      assert.equal(body.version, 1);
    });
  });

  describe('GET /api/audit', () => {
    it('returns audit entries from db', async () => {
      const pool = makeMockPool();
      pool._nextRows([{ sequence: 0, actor: DID.alice, event_type: 'CreateDecision' }]);
      const { statusCode, body } = await invoke(createHandler(pool, wasm), { url: '/api/audit' });
      assert.equal(statusCode, 200);
      assert.ok(Array.isArray(body));
    });
  });

  describe('GET /api/consent', () => {
    it('returns consent anchors from db', async () => {
      const pool = makeMockPool();
      pool._nextRows([{ id: 1, bailor_did: DID.alice }]);
      const { statusCode, body } = await invoke(createHandler(pool, wasm), { url: '/api/consent' });
      assert.equal(statusCode, 200);
      assert.ok(Array.isArray(body));
    });
  });

  describe('404 fallthrough', () => {
    it('returns 404 with available_endpoints list', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), { url: '/api/unknown-route' });
      assert.equal(statusCode, 404);
      assert.ok(Array.isArray(body.available_endpoints));
    });
  });
});
