// Shared test helpers for ExoChain service unit tests
// Provides mock factories for pg.Pool and WASM bindings.
// All synthetic data uses did:exo:test-* namespace — no real PII.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * Create a mock pg.Pool whose query() can be configured per-call.
 * Usage:
 *   const pool = makeMockPool();
 *   pool._nextRow({ id: 1 }); // next query returns this row
 */
export function makeMockPool() {
  const _queue = [];
  return {
    _nextRows(rows) { _queue.push({ rows }); },
    _nextRow(row) { _queue.push({ rows: row ? [row] : [] }); },
    _nextEmpty() { _queue.push({ rows: [] }); },
    async query(_sql, _params) {
      if (_queue.length > 0) return _queue.shift();
      return { rows: [] };
    },
  };
}

/**
 * Load the WASM stub (or real WASM if built).
 * Always safe to use in tests — won't throw if WASM binary missing.
 */
export function loadWasm() {
  return require('@exochain/exochain-wasm');
}

/**
 * Invoke a service handler with a synthetic HTTP request.
 * Returns { statusCode, headers, body } after response is fully written.
 *
 * @param {Function} handler - async (req, res) => void
 * @param {object} opts - { method, url, body? }
 */
export async function invoke(handler, { method = 'GET', url = '/', body } = {}) {
  return new Promise((resolve, reject) => {
    // Synthetic request
    const bodyStr = body !== undefined ? JSON.stringify(body) : '';
    const req = {
      method,
      url,
      headers: { host: 'localhost' },
      on(event, cb) {
        if (event === 'data' && bodyStr) cb(bodyStr);
        if (event === 'end') cb();
        return req;
      },
    };

    // Synthetic response collector
    let statusCode = 200;
    const headers = {};
    let responseBody = '';

    const res = {
      writeHead(code, hdrs) { statusCode = code; Object.assign(headers, hdrs || {}); },
      end(chunk) {
        if (chunk) responseBody += chunk;
        let parsed;
        try { parsed = JSON.parse(responseBody); } catch { parsed = responseBody; }
        resolve({ statusCode, headers, body: parsed });
      },
    };

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

// Synthetic DID helpers
export const DID = {
  alice: 'did:exo:test-alice',
  bob: 'did:exo:test-bob',
  council: 'did:exo:test-council',
};

export const ZERO_HASH = '0'.repeat(64);
