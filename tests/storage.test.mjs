import test from 'node:test';
import assert from 'node:assert/strict';
import { storage } from '../assets/js/services/storage.js';

function withLocalStorage(fn) {
  const previous = globalThis.localStorage;
  const memory = new Map();
  globalThis.localStorage = {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: key => memory.delete(key)
  };
  try { fn(memory); } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

test('history retains separate TV episode identities and de-duplicates repeats', () => withLocalStorage(() => {
  const first = { mediaType: 'tv', tmdbId: 1399, season: 1, episode: 1, title: 'A TV show' };
  const second = { ...first, episode: 2 };
  storage.addHistory(first);
  storage.addHistory(second);
  storage.addHistory(first);
  const history = storage.getHistory();
  assert.equal(history.length, 2);
  assert.equal(history[0].episode, 1);
  assert.equal(history[1].episode, 2);
  assert.notEqual(history[0].identity, history[1].identity);
}));

test('watchlist add/remove and Clear local library remain stable', () => withLocalStorage(() => {
  const item = { mediaType: 'movie', tmdbId: 27205, title: 'Example' };
  assert.equal(storage.toggleWatchlist(item).saved, true);
  assert.equal(storage.isSaved('movie', 27205), true);
  assert.equal(storage.toggleWatchlist(item).saved, false);
  assert.equal(storage.isSaved('movie', 27205), false);
  storage.toggleWatchlist(item);
  storage.addHistory(item);
  storage.clearLibrary();
  assert.deepEqual(storage.getHistory(), []);
  assert.deepEqual(storage.getWatchlist(), []);
}));

test('malformed browser data is handled without throwing', () => withLocalStorage(memory => {
  memory.set('pinflix.history.v2', '{not json');
  memory.set('pinflix.watchlist.v2', '{}');
  assert.deepEqual(storage.getHistory(), []);
  assert.deepEqual(storage.getWatchlist(), []);
}));
