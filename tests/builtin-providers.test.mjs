import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_PROVIDERS, buildBuiltinProviderUrl } from '../assets/js/services/providers.js';

const movie = { mediaType: 'movie', imdbId: 'tt1375666', tmdbId: 27205 };
const tv = { mediaType: 'tv', imdbId: 'tt9140554', tmdbId: 84958, season: 1, episode: 2 };

test('default sources are available without manual configuration', () => {
  assert.deepEqual(BUILTIN_PROVIDERS.map(p => p.id), ['multiembed', 'vsembed']);
});
test('builds MultiEmbed movie and TV URLs from IMDb ID', () => {
  const m = new URL(buildBuiltinProviderUrl('multiembed', movie));
  const t = new URL(buildBuiltinProviderUrl('multiembed', tv));
  assert.equal(m.hostname, 'multiembed.mov');
  assert.equal(m.searchParams.get('video_id'), 'tt1375666');
  assert.equal(t.searchParams.get('s'), '1');
  assert.equal(t.searchParams.get('e'), '2');
});
test('builds VSEmbed movie and TV URLs from IMDb ID', () => {
  const m = new URL(buildBuiltinProviderUrl('vsembed', movie));
  const t = new URL(buildBuiltinProviderUrl('vsembed', tv));
  assert.equal(m.pathname, '/embed/movie');
  assert.equal(t.pathname, '/embed/tv');
  assert.equal(t.searchParams.get('imdb'), 'tt9140554');
  assert.equal(t.searchParams.get('season'), '1');
  assert.equal(t.searchParams.get('episode'), '2');
});
test('rejects unknown providers, unsafe IDs, and incomplete TV episodes', () => {
  assert.equal(buildBuiltinProviderUrl('unknown', movie), '');
  assert.equal(buildBuiltinProviderUrl('multiembed', { ...movie, imdbId: 'bad-id' }), '');
  assert.equal(buildBuiltinProviderUrl('vsembed', { ...tv, episode: 0 }), '');
});
