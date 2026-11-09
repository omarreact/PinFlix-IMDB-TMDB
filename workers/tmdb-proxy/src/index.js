// PinFlix TMDB metadata proxy. TMDB_READ_ACCESS_TOKEN must be a Worker secret.
// Do not put the token in this source, the public site, or Wrangler configuration.
const TMDB = 'https://api.themoviedb.org/3';
const ALLOWED_ORIGINS = new Set([
  'https://omarreact.github.io',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
]);

function responseHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60'
  };
}

function json(data, status, origin = '') {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
  if (origin && ALLOWED_ORIGINS.has(origin)) Object.assign(headers, responseHeaders(origin));
  return new Response(JSON.stringify(data), { status, headers });
}

function approvedPath(url) {
  const path = url.pathname.replace(/^\/api\b/, '');
  const upstream = new URL(TMDB + path);
  if (/^\/trending\/all\/(day|week)$/.test(path)) return upstream;
  if (path === '/search/multi') {
    const query = url.searchParams.get('query')?.trim() || '';
    if (query.length < 2 || query.length > 120) return null;
    upstream.searchParams.set('query', query);
    upstream.searchParams.set('include_adult', 'false');
    return upstream;
  }
  if (/^\/(movie|tv)\/[1-9]\d{0,11}$/.test(path)) {
    upstream.searchParams.set('append_to_response', 'external_ids,videos');
    return upstream;
  }
  if (/^\/tv\/[1-9]\d{0,11}\/season\/(0|[1-9]\d{0,3})$/.test(path)) return upstream;
  return null;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origin not allowed' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: responseHeaders(origin) });
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, origin);
    if (!env.TMDB_READ_ACCESS_TOKEN) return json({ error: 'TMDB proxy is not configured' }, 503, origin);
    const url = new URL(request.url);
    const upstream = approvedPath(url);
    if (!upstream) return json({ error: 'Route not allowed' }, 404, origin);
    try {
      const res = await fetch(upstream, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${env.TMDB_READ_ACCESS_TOKEN}`, 'Accept': 'application/json' },
        redirect: 'error'
      });
      // Forward only the JSON body, never request headers or the server secret.
      return new Response(await res.text(), {
        status: res.status,
        headers: { ...responseHeaders(origin), 'Cache-Control': res.ok ? 'public, max-age=120' : 'no-store' }
      });
    } catch {
      return json({ error: 'TMDB is currently unavailable' }, 502, origin);
    }
  }
};
