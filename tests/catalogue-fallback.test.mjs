import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildCatalogueSnapshot } from '../scripts/catalogue-snapshot.mjs';
import { TmdbClient } from '../assets/js/services/tmdb.js';

const fixtures = {
  '/trending/all/week': {
    results: [
      { id: 1, media_type: 'movie', title: 'First Movie', overview: 'An adventure' },
      { id: 2, media_type: 'tv', name: 'First TV', overview: 'A story' }
    ]
  },
  '/movie/popular': { results: [{ id: 3, title: 'Popular Movie', overview: 'Popular' }] },
  '/tv/popular': { results: [{ id: 4, name: 'Popular TV', overview: 'TV hit' }] },
  '/movie/1': { id: 1, title: 'First Movie', external_ids: { imdb_id: 'tt1234567' } },
  '/tv/2': { id: 2, name: 'First TV', external_ids: { imdb_id: 'tt2345678' }, seasons: [{ season_number: 1, episode_count: 2 }] },
  '/movie/3': { id: 3, title: 'Popular Movie', external_ids: { imdb_id: 'tt3456789' } },
  '/tv/4': { id: 4, name: 'Popular TV', external_ids: { imdb_id: 'tt4567890' }, seasons: [{ season_number: 1, episode_count: 3 }] }
};

const fakeFetch = async (url) => {
  const path = new URL(url).pathname.replace(/^\/3/, '');
  const json = fixtures[path];
  return { ok: Boolean(json), status: json ? 200 : 404, json: async () => json };
};

test('GitHub Pages snapshot includes distinct trending and popular titles with IMDb identifiers', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'pinflix-catalogue-'));
  const file = join(temp, 'assets/data/tmdb-catalogue.json');
  try {
    const result = await buildCatalogueSnapshot({ fetchImpl: fakeFetch, apiKey: 'fixture-key', outputPath: file });
    assert.equal(result.count, 4);
    const snapshot = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(snapshot.version, 1);
    assert.ok(snapshot.generated_at);
    assert.equal(snapshot.items.length, 4);
    assert.equal(snapshot.details['movie:1'].external_ids.imdb_id, 'tt1234567');
    assert.equal(snapshot.details['tv:2'].seasons[0].episode_count, 2);
    assert.equal(JSON.stringify(snapshot).includes('fixture-key'), false);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('mobile network failure falls back to same-origin catalogue, search, details and episode numbers', async () => {
  let networkCalls = 0;
  const snapshot = {
    version: 1,
    generated_at: '2026-11-09T00:00:00Z',
    items: fixtures['/trending/all/week'].results,
    details: { 'movie:1': fixtures['/movie/1'], 'tv:2': fixtures['/tv/2'] }
  };
  const client = new TmdbClient('', async url => {
    if (String(url).startsWith('https://api.themoviedb.org')) {
      networkCalls++;
      throw new TypeError('Failed to fetch');
    }
    assert.equal(url, './assets/data/tmdb-catalogue.json');
    return { ok: true, json: async () => snapshot };
  }, { apiKey: 'fixture-key', catalogueUrl: './assets/data/tmdb-catalogue.json' });
  const items = await client.trending();
  assert.equal(items.length, 2);
  assert.equal(client.usingSnapshot, true);
  assert.equal(client.snapshotGeneratedAt, snapshot.generated_at);
  assert.equal((await client.searchMulti('First TV')).length, 1);
  assert.equal((await client.details('movie', 1)).external_ids.imdb_id, 'tt1234567');
  assert.deepEqual((await client.season(2, 1)).episodes.map(x => x.episode_number), [1, 2]);
  assert.equal(networkCalls, 1, 'subsequent actions should not retry the unavailable API');
});

test('live TMDB requests are preferred when the API is reachable', async () => {
  let localCalls = 0;
  const client = new TmdbClient('fixture-token', async url => {
    if (String(url).startsWith('./')) localCalls++;
    return { ok: true, json: async () => fixtures['/trending/all/week'] };
  }, { catalogueUrl: './assets/data/tmdb-catalogue.json' });
  const items = await client.trending();
  assert.equal(items.length, 2);
  assert.equal(client.usingSnapshot, false);
  assert.equal(localCalls, 0);
});

test('original TMDB network error is preserved if no snapshot is published', async () => {
  const client = new TmdbClient('fixture-token', async url => {
    if (String(url).startsWith('./')) return { ok: false, status: 404 };
    throw new TypeError('Network unreachable');
  }, { catalogueUrl: './assets/data/tmdb-catalogue.json' });
  await assert.rejects(() => client.trending(), /Network error while contacting TMDB/);
});

test('build embeds an independently readable inert catalogue in HTML', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'pinflix-embedded-'));
  const htmlFile = join(temp, 'index.html');
  const file = join(temp, 'assets/data/tmdb-catalogue.json');
  const marker = '<script type="module" src="assets/js/app.js"></script>';
  try {
    await writeFile(htmlFile, '<html><body>' + marker + '</body></html>');
    await buildCatalogueSnapshot({ fetchImpl: fakeFetch, apiKey: 'fixture-key', outputPath: file, htmlPath: htmlFile });
    const html = await readFile(htmlFile, 'utf8');
    const open = '<template id="pinflix-embedded-catalogue">';
    const start = html.indexOf(open);
    const end = html.indexOf('</template>', start + open.length);
    assert.ok(start !== -1 && end > start, 'the catalogue must be included in the delivered HTML');
    const embedded = JSON.parse(html.slice(start + open.length, end));
    assert.equal(embedded.items.length, 4);
    assert.equal(embedded.details['movie:1'].external_ids.imdb_id, 'tt1234567');
    assert.equal(html.includes('fixture-key'), false, 'the key must never enter the HTML');
    assert.ok(html.includes(marker), 'the JS app must continue loading');
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('an embedded catalogue provides results when both TMDB and the JSON endpoint fail', async () => {
  const snapshot = {
    version: 1,
    generated_at: '2026-11-09T00:00:00Z',
    items: fixtures['/trending/all/week'].results,
    details: { 'movie:1': fixtures['/movie/1'], 'tv:2': fixtures['/tv/2'] }
  };
  let requests = 0;
  const client = new TmdbClient('', async () => {
    requests++;
    throw new TypeError('Blocked network request');
  }, { apiKey: 'fixture-key', catalogueUrl: './assets/data/tmdb-catalogue.json' });
  client.cataloguePromise = Promise.resolve(snapshot);
  assert.equal((await client.trending()).length, 2);
  assert.equal(client.usingSnapshot, true);
  assert.equal((await client.searchMulti('First')).length, 2);
  assert.equal((await client.details('movie', 1)).external_ids.imdb_id, 'tt1234567');
  assert.equal(requests, 1, 'only the first direct TMDB attempt should occur');
});
