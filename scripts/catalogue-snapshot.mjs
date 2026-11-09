// Build a same-origin TMDB snapshot for browsers that cannot reach api.themoviedb.org.
// Runs during npm run build (local, GitHub Actions or Vercel). Never log credentials or URLs.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEV_TMDB_API_KEY } from '../assets/js/dev-config.js';

const TMDB_API = 'https://api.themoviedb.org/3';

export async function buildCatalogueSnapshot({
  fetchImpl = fetch,
  apiKey = DEV_TMDB_API_KEY,
  outputPath = 'dist/assets/data/tmdb-catalogue.json',
  htmlPath = null,
  maxTitles = 64
} = {}) {
  if (!apiKey) throw new Error('TMDB public v3 API key is required to build the catalogue.');
  const request = async (path, params = {}) => {
    const url = new URL(TMDB_API + path);
    url.searchParams.set('api_key', apiKey);
    for (const [key, val] of Object.entries(params)) url.searchParams.set(key, String(val));
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(14000) });
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

  // Embed a non-executable JSON data block in the deployed HTML. On mobile,
  // the entire catalogue then arrives with the document, without a second
  // HTTP request that an old service worker or network filter could break.
  if (htmlPath) {
    const html = await readFile(htmlPath, 'utf8');
    const marker = '<script type="module" src="assets/js/app.js"></script>';
    if (!html.includes(marker)) throw new Error('Unable to locate app module in HTML for catalogue injection.');
    // Escape HTML-sensitive characters to keep TMDB strings inert in a template.
    const serialized = JSON.stringify(snapshot).replace(/&/g, '\\u0026').replace(/</g, '\\u003c');
    const dataBlock = '<template id="pinflix-embedded-catalogue">' + serialized + '</template>\n';
    await writeFile(htmlPath, html.replace(marker, dataBlock + marker));
  }
  return { count: items.length, details: Object.keys(details).length, outputPath };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildCatalogueSnapshot({
      outputPath: process.argv[2] || 'dist/assets/data/tmdb-catalogue.json',
      htmlPath: 'dist/index.html'
    });
    console.log(`Same-origin TMDB catalogue snapshot generated: ${result.count} titles, ${result.details} detail records.`);
  } catch (error) {
    console.error('Catalogue snapshot generation failed:', error.message);
    process.exitCode = 1;
  }
}
