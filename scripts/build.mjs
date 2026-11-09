import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildCatalogueSnapshot } from './catalogue-snapshot.mjs';

const out = new URL('../dist/', import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const item of ['index.html', '404.html', 'manifest.webmanifest', 'sw.js', 'assets']) {
  await cp(new URL(`../${item}`, import.meta.url), new URL(item, out), { recursive: true });
}
const result = await buildCatalogueSnapshot({
  outputPath: fileURLToPath(new URL('assets/data/tmdb-catalogue.json', out)),
  htmlPath: fileURLToPath(new URL('index.html', out))
});
const info = await stat(new URL('index.html', out));
console.log(`Built deployable dist/ (${info.size} bytes HTML, ${result.count} catalogue titles).`);
