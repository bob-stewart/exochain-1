// provenance-writer unit tests
// Tests evidence creation, chain of custody, fiduciary duty, eDiscovery — TransparencyAccountability invariant
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/index.js';
import { makeMockPool, loadWasm, invoke, DID, ZERO_HASH } from '../../../test/helpers.js';

const wasm = loadWasm();

describe('provenance-writer', () => {
  describe('GET /health', () => {
    it('returns 200 ok', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), { url: '/health' });
      assert.equal(statusCode, 200);
      assert.equal(body.service, 'provenance-writer');
    });
  });

  describe('POST /api/evidence/create — TransparencyAccountability', () => {
    it('creates evidence with content_hash and creator_did', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/evidence/create',
        body: { content: 'board-resolution-2026-03', type_tag: 'document', creator_did: DID.alice },
      });
      assert.equal(statusCode, 201);
      assert.ok(body.evidence_id);
      assert.equal(body.creator_did, DID.alice);
      assert.equal(body.type_tag, 'document');
      assert.ok(body.content_hash, 'should have content_hash');
      assert.equal(body.content_hash.length, 64);
    });

    it('handles empty content gracefully', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/evidence/create',
        body: { content: '', type_tag: 'note', creator_did: DID.bob },
      });
      assert.equal(statusCode, 201);
      assert.ok(body.evidence_id);
    });
  });

  describe('POST /api/evidence/verify — chain of custody', () => {
    it('verifies a valid evidence chain', async () => {
      const { body: evidence } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/evidence/create',
        body: { content: 'testimony', type_tag: 'witness_statement', creator_did: DID.alice },
      });

      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/evidence/verify',
        body: { evidence },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.valid, true);
    });
  });

  describe('POST /api/fiduciary/check', () => {
    it('reports fiduciary compliance', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/fiduciary/check',
        body: { duty: { type: 'CareAndLoyalty', beneficiary: DID.alice }, actions: [] },
      });
      assert.equal(statusCode, 200);
      assert.equal(body.compliant, true);
      assert.ok(Array.isArray(body.violations));
    });
  });

  describe('POST /api/ediscovery/search', () => {
    it('returns matching documents from corpus', async () => {
      const corpus = [
        { id: 'doc-1', content: 'board resolution' },
        { id: 'doc-2', content: 'financial report' },
      ];
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/ediscovery/search',
        body: { request: { query: 'resolution', date_range: [0, Date.now()] }, corpus },
      });
      assert.equal(statusCode, 200);
      assert.ok(typeof body.total === 'number');
    });

    it('returns empty results for empty corpus', async () => {
      const { body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/ediscovery/search',
        body: { request: { query: 'anything' }, corpus: [] },
      });
      assert.equal(body.total, 0);
    });
  });

  describe('POST /api/escalation/evaluate', () => {
    it('evaluates escalation signals and returns risk level', async () => {
      const { statusCode, body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/escalation/evaluate',
        body: { signals: [{ type: 'UnusualVotingPattern', severity: 'Low' }] },
      });
      assert.equal(statusCode, 200);
      assert.ok(body.risk_level);
      assert.equal(typeof body.escalate, 'boolean');
    });

    it('handles empty signals array', async () => {
      const { body } = await invoke(createHandler(makeMockPool(), wasm), {
        method: 'POST', url: '/api/escalation/evaluate',
        body: { signals: [] },
      });
      assert.equal(body.signals_evaluated, 0);
    });
  });

  describe('404 fallthrough', () => {
    it('returns 404 for unknown routes', async () => {
      const { statusCode } = await invoke(createHandler(makeMockPool(), wasm), { url: '/api/unknown' });
      assert.equal(statusCode, 404);
    });
  });
});
