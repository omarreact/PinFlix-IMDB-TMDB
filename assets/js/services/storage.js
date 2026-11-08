import { safeJsonParse } from '../lib/validation.js';

const KEYS = {
  token: 'pinflix.tmdb-token',
  history: 'pinflix.history.v2',
  watchlist: 'pinflix.watchlist.v2',
  providerTemplate: 'pinflix.provider-template.v1'
};

function storageAvailable() {
  try {
    const k = '__pinflix_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function readArray(key) {
  if (!storageAvailable()) return [];
  const value = safeJsonParse(localStorage.getItem(key), []);
  return Array.isArray(value) ? value : [];
}

function writeArray(key, value) {
  if (!storageAvailable()) return;
  localStorage.setItem(key, JSON.stringify(value.slice(0, 100)));
}

export const storage = {
  getToken() {
    return storageAvailable() ? localStorage.getItem(KEYS.token) || '' : '';
  },
  setToken(value) {
    if (!storageAvailable()) return;
    if (value) localStorage.setItem(KEYS.token, value.trim());
    else localStorage.removeItem(KEYS.token);
  },
  getProviderTemplate() {
    return storageAvailable() ? localStorage.getItem(KEYS.providerTemplate) || '' : '';
  },
  setProviderTemplate(value) {
    if (!storageAvailable()) return;
    if (value) localStorage.setItem(KEYS.providerTemplate, value.trim());
    else localStorage.removeItem(KEYS.providerTemplate);
  },
  getHistory() { return readArray(KEYS.history); },
  getWatchlist() { return readArray(KEYS.watchlist); },
  addHistory(item) {
    const list = readArray(KEYS.history);
    const identity = `${item.mediaType}:${item.tmdbId}:${item.season ?? ''}:${item.episode ?? ''}`;
    const next = [
      { ...item, identity, watchedAt: Date.now() },
      ...list.filter(entry => entry.identity !== identity)
    ];
    writeArray(KEYS.history, next);
    return next;
  },
  toggleWatchlist(item) {
    const list = readArray(KEYS.watchlist);
    const identity = `${item.mediaType}:${item.tmdbId}`;
    const exists = list.some(entry => entry.identity === identity);
    const next = exists
      ? list.filter(entry => entry.identity !== identity)
      : [{ ...item, identity, savedAt: Date.now() }, ...list];
    writeArray(KEYS.watchlist, next);
    return { list: next, saved: !exists };
  },
  isSaved(mediaType, tmdbId) {
    const identity = `${mediaType}:${tmdbId}`;
    return readArray(KEYS.watchlist).some(entry => entry.identity === identity);
  },
  clearLibrary() {
    if (!storageAvailable()) return;
    localStorage.removeItem(KEYS.history);
    localStorage.removeItem(KEYS.watchlist);
  }
};
