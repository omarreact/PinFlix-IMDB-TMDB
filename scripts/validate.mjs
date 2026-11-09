import { access, readFile } from 'node:fs/promises';
import { RESTRICTED_SANDBOX } from '../assets/js/services/player-security.js';

const required = [
  'index.html', 'manifest.webmanifest', 'sw.js', 'assets/css/styles.css',
  'assets/js/app.js', 'assets/js/dev-config.js', 'assets/js/lib/validation.js',
  'assets/js/services/storage.js', 'assets/js/services/tmdb.js',
  'assets/js/services/providers.js', 'assets/js/services/player-security.js',
  'scripts/build.mjs', 'scripts/catalogue-snapshot.mjs', 'scripts/serve.mjs',
  'vercel.json', '.github/workflows/pages.yml'
];
for (const file of required) await access(new URL(`../${file}`, import.meta.url));
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
for (const marker of [
  'Content-Security-Policy', `sandbox="${RESTRICTED_SANDBOX}"`,
  'referrerpolicy="no-referrer"', 'assets/js/app.js',
  'id="toggle-compatibility"', 'id="switch-provider"'
]) {
  if (!html.includes(marker)) throw new Error(`Missing required marker: ${marker}`);
}
const app = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');
if (/innerHTML\s*=/.test(app)) throw new Error('Unsafe innerHTML assignment found in app.js');
for (const name of ['settings-dialog', 'open-settings', 'provider-template', 'tmdb-token']) {
  if (html.includes(`id="${name}"`)) throw new Error(`Visitor configuration UI reintroduced: ${name}`);
}
const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
if (vercel.outputDirectory !== 'dist' || vercel.buildCommand !== 'npm run build:vercel' ||
    pkg.scripts['build:vercel'] !== 'npm run build' || pkg.scripts.build !== 'node scripts/build.mjs') {
  throw new Error('Vercel and local builds must use the same snapshot-generating pipeline.');
}
const builder = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
if (!builder.includes('buildCatalogueSnapshot(')) throw new Error('npm run build must generate the embedded catalogue.');
console.log('Static validation passed.');
