import test from 'node:test'; import assert from 'node:assert/strict'; import { buildProviderUrl } from '../assets/js/services/providers.js';
test('builds movie provider URL',()=>assert.equal(buildProviderUrl('https://example.com/{imdb}?tmdb={tmdb}',{imdbId:'tt1375666',tmdbId:27205,mediaType:'movie'}),'https://example.com/tt1375666?tmdb=27205'));
test('builds episode provider URL',()=>assert.equal(buildProviderUrl('https://example.com/{imdb}/{season}/{episode}',{imdbId:'tt0944947',tmdbId:1399,mediaType:'tv',season:1,episode:2}),'https://example.com/tt0944947/1/2'));
test('rejects insecure provider template',()=>assert.equal(buildProviderUrl('http://example.com/{imdb}',{imdbId:'tt1375666',tmdbId:1,mediaType:'movie'}),''));
