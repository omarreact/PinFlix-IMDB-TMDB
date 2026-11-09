import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImdbId, positiveInt, safeJsonParse, librarySelection } from '../assets/js/lib/validation.js';

test('validates IDs and integer bounds', () => {
  assert.equal(normalizeImdbId('tt1375666'), 'tt1375666');
  assert.equal(normalizeImdbId('<img onerror=1>'), null);
  assert.equal(positiveInt('2'), 2);
  assert.equal(positiveInt('0'), null);
  assert.equal(positiveInt('1001', { max: 1000 }), null);
});
test('safe JSON parsing tolerates corrupted storage', () => {
  assert.deepEqual(safeJsonParse('{', []), []);
});
test('librarySelection restores a saved TV episode without changing its identity', () => {
  assert.deepEqual(librarySelection({ mediaType: 'tv', tmdbId: 1399, season: 2, episode: 7 }), {
    mediaType: 'tv', tmdbId: 1399, season: 2, episode: 7
  });
  assert.deepEqual(librarySelection({ mediaType: 'movie', tmdbId: 27205 }), {
    mediaType: 'movie', tmdbId: 27205, season: null, episode: null
  });
});
test('librarySelection rejects invalid IDs and partial episode references', () => {
  assert.equal(librarySelection({ mediaType: 'person', tmdbId: 1 }), null);
  assert.equal(librarySelection({ mediaType: 'tv', tmdbId: 'nope' }), null);
  assert.deepEqual(librarySelection({ mediaType: 'tv', tmdbId: 1399, season: 1 }), {
    mediaType: 'tv', tmdbId: 1399, season: null, episode: null
  });
});
