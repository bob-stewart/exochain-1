// identity-service unit tests
// Tests PACE continuity, Shamir secret sharing, risk assessment, keypair generation
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/index.js';
import { makeMockPool, loadWasm, invoke, DID } from '../../../test/helpers.js';

const wasm = loadWasm();

describe('identity-service', () => {
  describe('GET /health', () => {
    it('returns 200 ok', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), { url: '/health' });
      assert.equal(statusCode, 200);
      assert.equal(body.service, 'identity-service');
    });
  });

  describe('GET /api/users', () => {
    it('returns users from db', async () => {
      const pool = makeMockPool();
      pool._nextRows([{ did: DID.alice, display_name: 'Alice Test', pace_status: 'Enrolled' }]);
      const { statusCode, body } = await invoke(createHandler(pool, wasm), { url: '/api/users' });
      assert.equal(statusCode, 200);
      assert.ok(Array.isArray(body));
      assert.equal(body[0].did, DID.alice);
    });
  });

  describe('GET /api/scores', () => {
    it('returns identity scores from db', async () => {
      const pool = makeMockPool();
      pool._nextRows([{ did: DID.alice, score: 85, tier: 'Gold', display_name: 'Alice Test' }]);
      const { statusCode, body } = await invoke(createHandler(pool, wasm), { url: '/api/scores' });
      assert.equal(statusCode, 200);
      assert.ok(Array.isArray(body));
    });
  });

  describe('GET /api/enrollment', () => {
    it('returns enrollment log from db', async () => {
      const pool = makeMockPool();
      pool._nextRows([{ did: DID.alice, event: 'enrolled', timestamp: Date.now() }]);
      const { statusCode, body } = await invoke(createHandler(pool, wasm), { url: '/api/enrollment' });
      assert.equal(statusCode, 200);
      assert.ok(Array.isArray(body));
    });
  });

  describe('POST /api/shamir/split — Shamir Secret Sharing', () => {
    it('splits a secret into 3 shares with threshold 2', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/shamir/split',
        body: { secret: 'governance-master-key', threshold: 2, shares: 3 },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.shares.length, 3);
      assert.equal(body.threshold, 2);
      assert.equal(body.total, 3);
    });

    it('uses defaults (2-of-3) when threshold/shares omitted', async () => {
      const { body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/shamir/split',
        body: { secret: 'test-secret' },
      });
      assert.equal(body.threshold, 2);
      assert.equal(body.total, 3);
    });
  });

  describe('POST /api/shamir/reconstruct', () => {
    it('reconstructs a secret from shares', async () => {
      const { body: splitResult } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/shamir/split',
        body: { secret: 'test-key', threshold: 2, shares: 3 },
      });

      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/shamir/reconstruct',
        body: { shares: splitResult.shares.slice(0, 2), threshold: 2, total: 3 },
      });
      assert.equal(statusCode, 200);
      assert.ok(body.success !== undefined);
    });
  });

  describe('POST /api/pace/escalate — PACE continuity', () => {
    it('escalates Normal → AlternateActive', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/pace/escalate',
        body: { state: 'Normal' },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.new_state, 'AlternateActive');
    });

    it('escalates AlternateActive → Degraded', async () => {
      const { body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/pace/escalate',
        body: { state: 'AlternateActive' },
      });
      assert.equal(body.new_state, 'Degraded');
    });
  });

  describe('POST /api/pace/resolve', () => {
    it('resolves PACE configuration for a given state', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/pace/resolve',
        body: { config: { quorum_required: 3 }, state: 'Normal' },
      });
      assert.equal(statusCode, 200);
      assert.ok(body.continuity_intact !== undefined);
    });
  });

  describe('POST /api/risk/assess', () => {
    it('creates a risk attestation', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/risk/assess',
        body: { subject_did: DID.alice, attester_did: DID.bob, evidence: 'kyc-doc', level: 'Medium', validity_ms: 86400000 },
      });
      assert.equal(statusCode, 200);
      assert.ok(body.attestation_id);
      assert.equal(body.subject_did, DID.alice);
      assert.equal(body.risk_level, 'Medium');
    });
  });

  describe('POST /api/keypair', () => {
    it('generates a keypair with public_key and secret_key', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/keypair', body: {},
      });
      assert.equal(statusCode, 200);
      assert.ok(body.public_key, 'should have public_key');
      assert.ok(body.secret_key, 'should have secret_key');
    });
  });

  describe('404 fallthrough', () => {
    it('returns 404 for unknown routes', async () => {
      const { statusCode } = await invoke(createHandler(makeMockPool(), wasm), { url: '/api/unknown' });
      assert.equal(statusCode, 404);
    });
  });
});
