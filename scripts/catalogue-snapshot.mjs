// Build a same-origin TMDB snapshot for browsers that cannot reach api.themoviedb.org.
// This runs on GitHub Actions, not in the visitor's browser. Never log credentials or URLs.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEV_TMDB_API_KEY, DEV_TMDB_READ_ACCESS_TOKEN } from '../assets/js/dev-config.js';

const TMDB_API = 'https://api.themoviedb.org/3';

export async function buildCatalogueSnapshot({
  fetchImpl = fetch,
  apiKey = DEV_TMDB_API_KEY,
  token = DEV_TMDB_READ_ACCESS_TOKEN,
  outputPath = 'dist/assets/data/tmdb-catalogue.json',
  maxTitles = 64
} = {}) {
  if (!apiKey && !token) throw new Error('No TMDB credentials available for snapshot.');
  const request = async (path, params = {}) => {
    const url = new URL(TMDB_API + path);
    if (!token) url.searchParams.set('api_key', apiKey);
    for (const [key, val] of Object.entries(params)) url.searchParams.set(key, String(val));
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(14000) });
    if (!response.ok) throw new Error(`TMDB snapshot API HTTP ${response.status}`);
    return response.json();
  };

  const feeds = await Promise.all([
    request('/trending/all/week'),
    request('/movie/popular'),
    request('/tv/popular')
  ]);

  const unique = new Map();
  const entries = [
    ...(feeds[0].results || []),
    ...(feeds[1].results || []).map(item => ({ ...item, media_type: 'movie' })),
    ...(feeds[2].results || []).map(item => ({ ...item, media_type: 'tv' }))
  ];
  for (const item of entries) {
    if (!['movie', 'tv'].includes(item.media_type) || !Number.isInteger(item.id)) continue;
    const identity = `${item.media_type}:${item.id}`;
    if (!unique.has(identity)) unique.set(identity, item);
    if (unique.size >= maxTitles) break;
  }
  if (!unique.size) throw new Error('TMDB snapshot was empty.');

  const items = [...unique.values()];
  const details = {};
  const queue = [...items];
  // Limit concurrency so a GitHub Pages build does not flood TMDB.
  const worker = async () => {
    while (queue.length) {
      const item = queue.shift();
      const id = `${item.media_type}:${item.id}`;
      try {
        details[id] = await request(`/${item.media_type}/${item.id}`, {
          append_to_response: 'external_ids,videos'
        });
      } catch {
        // Catalogue browsing remains useful when an individual detail request fails.
        details[id] = { ...item, external_ids: {}, seasons: [] };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, items.length) }, () => worker()));
  const snapshot = {
    version: 1,
    generated_at: new Date().toISOString(),
    items,
    details
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(snapshot));
  return { count: items.length, details: Object.keys(details).length, outputPath };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildCatalogueSnapshot({
      outputPath: process.argv[2] || 'dist/assets/data/tmdb-catalogue.json'
    });
    console.log(`Same-origin TMDB catalogue snapshot generated: ${result.count} titles, ${result.details} detail records.`);
  } catch (error) {
    console.error('Catalogue snapshot generation failed:', error.message);
    process.exitCode = 1;
  }
}
