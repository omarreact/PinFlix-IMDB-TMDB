import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../workers/tmdb-proxy/src/index.js';

const secret = { TMDB_READ_ACCESS_TOKEN: 'test-secret' };
const origin = 'https://omarreact.github.io';
const req = (path, method = 'GET', site = origin) => new Request('https://example.workers.dev' + path, { method, headers: { Origin: site } });

test('rejects requests from other origins', async () => {
  const result = await worker.fetch(req('/trending/all/week', 'GET', 'https://untrusted.example'), secret);
  assert.equal(result.status, 403);
});

test('rejects non-GET operations and open-proxy paths', async () => {
  assert.equal((await worker.fetch(req('/trending/all/week', 'POST'), secret)).status, 405);
  assert.equal((await worker.fetch(req('/account/1'), secret)).status, 404);
  assert.equal((await worker.fetch(req('/search/multi?query=x'), secret)).status, 404);
});

test('does not leak a secret when missing configuration', async () => {
  const result = await worker.fetch(req('/trending/all/week'), {});
  assert.equal(result.status, 503);
  assert.ok(!(await result.text()).includes('test-secret'));
});

test('preflight and allowed routes work without exposing the read token to the browser', async () => {
  const preflight = await worker.fetch(req('/search/multi', 'OPTIONS'), secret);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url: String(url), options };
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  };
  try {
    const result = await worker.fetch(req('/search/multi?query=matrix&api_key=unwanted'), secret);
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('access-control-allow-origin'), origin);
    assert.equal(captured.options.headers.Authorization, 'Bearer test-secret');
    assert.equal(new URL(captured.url).searchParams.get('api_key'), null);
    assert.equal(new URL(captured.url).searchParams.get('query'), 'matrix');
    assert.ok(!(await result.text()).includes('test-secret'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
