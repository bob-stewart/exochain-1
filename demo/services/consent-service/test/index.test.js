// consent-service unit tests
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/index.js';
import { makeMockPool, loadWasm, invoke, DID } from '../../../test/helpers.js';

const wasm = loadWasm();

describe('consent-service', () => {
  describe('GET /health', () => {
    it('returns 200 ok', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), { url: '/health' });
      assert.equal(statusCode, 200);
      assert.equal(body.service, 'consent-service');
    });
  });

  describe('GET /api/anchors', () => {
    it('returns consent anchors from db', async () => {
      const pool = makeMockPool();
      pool._nextRows([{ id: 1, bailor_did: DID.alice, bailee_did: DID.bob }]);
      const { statusCode, body } = await invoke(createHandler(pool, wasm), { url: '/api/anchors' });
      assert.equal(statusCode, 200);
      assert.ok(Array.isArray(body));
      assert.equal(body[0].bailor_did, DID.alice);
    });

    it('returns empty array when no anchors', async () => {
      const pool = makeMockPool();
      pool._nextEmpty();
      const { statusCode, body } = await invoke(createHandler(pool, wasm), { url: '/api/anchors' });
      assert.equal(statusCode, 200);
      assert.deepEqual(body, []);
    });
  });

  describe('POST /api/bailment/propose', () => {
    it('creates a bailment with required fields', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST',
        url: '/api/bailment/propose',
        body: { bailor_did: DID.alice, bailee_did: DID.bob, terms: 'data-processing', bailment_type: 'Processing' },
      });
      assert.equal(statusCode, 200);
      assert.ok(body.bailment_id, 'should have bailment_id');
      assert.equal(body.bailor_did, DID.alice);
      assert.equal(body.bailee_did, DID.bob);
    });

    it('uses Processing as default bailment type when omitted', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST',
        url: '/api/bailment/propose',
        body: { bailor_did: DID.alice, bailee_did: DID.bob },
      });
      assert.equal(statusCode, 200);
      assert.ok(body.bailment_id);
    });
  });

  describe('POST /api/bailment/active', () => {
    it('returns active: false for Proposed bailment', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST',
        url: '/api/bailment/active',
        body: { bailment: { bailment_id: 'bail-001', status: 'Proposed' } },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.active, false);
    });

    it('returns active: true for Active bailment', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST',
        url: '/api/bailment/active',
        body: { bailment: { bailment_id: 'bail-002', status: 'Active' } },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.active, true);
    });
  });

  describe('404 fallthrough', () => {
    it('returns 404 for unknown routes', async () => {
      const { statusCode } = await invoke(createHandler(makeMockPool(), wasm), { url: '/api/unknown' });
      assert.equal(statusCode, 404);
    });
  });
});
