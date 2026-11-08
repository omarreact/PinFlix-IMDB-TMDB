import test from 'node:test'; import assert from 'node:assert/strict'; import { normalizeImdbId, positiveInt, safeJsonParse, providerTemplateIsValid } from '../assets/js/lib/validation.js';
test('accepts valid IMDb id',()=>assert.equal(normalizeImdbId('tt1375666'),'tt1375666'));
test('rejects hostile IMDb id',()=>assert.equal(normalizeImdbId('<img onerror=1>'),null));
test('validates positive integers',()=>{assert.equal(positiveInt('2'),2);assert.equal(positiveInt('0'),null)});
test('safe JSON parse recovers from corruption',()=>assert.deepEqual(safeJsonParse('{',[]),[]));
test('provider template requires HTTPS',()=>{assert.equal(providerTemplateIsValid('https://example.com/{imdb}'),true);assert.equal(providerTemplateIsValid('http://example.com/{imdb}'),false)});
