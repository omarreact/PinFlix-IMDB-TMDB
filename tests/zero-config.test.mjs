import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BUILTIN_PROVIDERS, buildBuiltinProviderUrl } from '../assets/js/services/providers.js';

const source = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('no visitor-facing Settings or playback configuration fields exist', async () => {
  const html = await source('index.html');
  for (const hiddenUI of [
    'id="open-settings"',
    'id="settings-dialog"',
    'id="provider-template"',
    'id="backup-provider-template"',
    'id="tmdb-token"',
    'Playback configuration'
  ]) assert.equal(html.includes(hiddenUI), false, hiddenUI);
  assert.ok(html.includes('id="search-form"'));
  assert.ok(html.includes('id="stream-frame"'));
  assert.ok(html.includes('id="switch-provider"'));
});

test('app never reads user-selected provider URLs or opens a settings modal', async () => {
  const app = await source('assets/js/app.js');
  for (const obsolete of [
    'getProviderTemplate(', 'getBackupProviderTemplate(',
    'setProviderTemplate(', 'setBackupProviderTemplate(',
    'openSettings(', 'saveSettings('
  ]) assert.equal(app.includes(obsolete), false, obsolete);
  assert.ok(app.includes('buildBuiltinProviderUrl('));
  assert.ok(app.includes('DEV_TMDB_API_KEY'));
  assert.ok(app.includes("catalogueUrl: './assets/data/tmdb-catalogue.json'"));
});

test('codebase-defined providers generate movie and episode URLs without any settings', () => {
  assert.equal(BUILTIN_PROVIDERS.length, 2);
  assert.equal(BUILTIN_PROVIDERS[0].id, 'multiembed');
  assert.equal(BUILTIN_PROVIDERS[1].id, 'vsembed');
  const movie = { mediaType:'movie', imdbId:'tt1375666', tmdbId:27205 };
  const tv = { mediaType:'tv', imdbId:'tt0944947', tmdbId:1399, season:2, episode:3 };
  assert.equal(buildBuiltinProviderUrl('multiembed',movie), 'https://multiembed.mov/?video_id=tt1375666');
  assert.equal(buildBuiltinProviderUrl('vsembed',movie), 'https://vsembed.ru/embed/movie?imdb=tt1375666');
  assert.equal(buildBuiltinProviderUrl('multiembed',tv), 'https://multiembed.mov/?video_id=tt0944947&s=2&e=3');
  assert.equal(buildBuiltinProviderUrl('vsembed',tv), 'https://vsembed.ru/embed/tv?imdb=tt0944947&season=2&episode=3');
});
