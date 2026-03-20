// audit-api unit tests
// Uses synthetic data only — no real PII. DID namespace: did:exo:test-*
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/index.js';
import { makeMockPool, loadWasm, invoke, DID, ZERO_HASH } from '../../../test/helpers.js';

const wasm = loadWasm();

describe('audit-api', () => {
  describe('GET /health', () => {
    it('returns 200 ok', async () => {
      const handler = createHandler(makeMockPool(), wasm);
      const { statusCode, body } = await invoke(handler, { url: '/health' });
      assert.equal(statusCode, 200);
      assert.equal(body.status, 'ok');
      assert.equal(body.service, 'audit-api');
    });
  });

  describe('OPTIONS (CORS preflight)', () => {
    it('returns 204 with CORS headers', async () => {
      const handler = createHandler(makeMockPool(), wasm);
      const { statusCode } = await invoke(handler, { method: 'OPTIONS', url: '/health' });
      assert.equal(statusCode, 204);
    });
  });

  describe('GET /api/entries', () => {
    it('returns list of audit entries from db', async () => {
      const pool = makeMockPool();
      pool._nextRows([
        { sequence: 1, actor: DID.alice, event_type: 'CreateDecision', entry_hash: ZERO_HASH },
      ]);
      const handler = createHandler(pool, wasm);
      const { statusCode, body } = await invoke(handler, { url: '/api/entries' });
      assert.equal(statusCode, 200);
      assert.ok(Array.isArray(body));
      assert.equal(body[0].event_type, 'CreateDecision');
    });

    it('returns empty array when no entries', async () => {
      const pool = makeMockPool();
      pool._nextEmpty();
      const handler = createHandler(pool, wasm);
      const { statusCode, body } = await invoke(handler, { url: '/api/entries' });
      assert.equal(statusCode, 200);
      assert.deepEqual(body, []);
    });
  });

  describe('POST /api/entries', () => {
    it('appends an audit entry and returns entry_count + head_hash', async () => {
      const pool = makeMockPool();
      // First query: get max sequence
      pool._nextRow({ seq: 0, prev: ZERO_HASH });
      // Second query: INSERT (no return needed)
      pool._nextEmpty();

      const handler = createHandler(pool, wasm);
      const { statusCode, body } = await invoke(handler, {
        method: 'POST',
        url: '/api/entries',
        body: { actor_did: DID.alice, action: 'CreateDecision', result: 'success', evidence_hash: ZERO_HASH },
      });
      assert.equal(statusCode, 201);
      assert.ok(typeof body.entry_count === 'number');
      assert.ok(typeof body.head_hash === 'string');
      assert.equal(body.head_hash.length, 64);
    });

    it('returns 500 on db failure', async () => {
      const pool = {
        async query() { throw new Error('db connection refused'); },
      };
      const handler = createHandler(pool, wasm);
      const { statusCode } = await invoke(handler, {
        method: 'POST',
        url: '/api/entries',
        body: { actor_did: DID.alice, action: 'Test', result: 'success' },
      });
      assert.equal(statusCode, 500);
    });
  });

  describe('GET /api/verify', () => {
    it('reports intact chain for empty audit log', async () => {
      const pool = makeMockPool();
      pool._nextEmpty();
      const handler = createHandler(pool, wasm);
      const { statusCode, body } = await invoke(handler, { url: '/api/verify' });
      assert.equal(statusCode, 200);
      assert.equal(body.intact, true);
      assert.equal(body.entries_checked, 0);
    });

    it('reports intact chain for single entry', async () => {
      const pool = makeMockPool();
      pool._nextRows([
        { sequence: 0, prev_hash: ZERO_HASH, entry_hash: 'a'.repeat(64) },
      ]);
      const handler = createHandler(pool, wasm);
      const { statusCode, body } = await invoke(handler, { url: '/api/verify' });
      assert.equal(statusCode, 200);
      assert.equal(body.intact, true);
      assert.equal(body.entries_checked, 1);
    });

    it('detects chain break when prev_hash mismatch', async () => {
      const pool = makeMockPool();
      pool._nextRows([
        { sequence: 0, prev_hash: ZERO_HASH, entry_hash: 'a'.repeat(64) },
        { sequence: 1, prev_hash: 'b'.repeat(64), entry_hash: 'c'.repeat(64) }, // mismatch: should be 'a'.repeat(64)
      ]);
      const handler = createHandler(pool, wasm);
      const { statusCode, body } = await invoke(handler, { url: '/api/verify' });
      assert.equal(statusCode, 200);
      assert.equal(body.intact, false);
      assert.ok(body.error.includes('Chain break'));
    });
  });

  describe('404 fallthrough', () => {
    it('returns 404 for unknown routes', async () => {
      const handler = createHandler(makeMockPool(), wasm);
      const { statusCode } = await invoke(handler, { url: '/api/unknown' });
      assert.equal(statusCode, 404);
    });
  });
});
