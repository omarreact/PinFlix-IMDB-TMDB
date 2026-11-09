import { access, readFile } from 'node:fs/promises';
const required=['index.html','manifest.webmanifest','sw.js','assets/css/styles.css','assets/js/app.js','assets/js/dev-config.js','assets/js/lib/validation.js','assets/js/services/storage.js','assets/js/services/tmdb.js','assets/js/services/providers.js','assets/js/services/player-security.js','scripts/catalogue-snapshot.mjs','vercel.json','.github/workflows/pages.yml'];
for(const file of required) await access(new URL(`../${file}`,import.meta.url));
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
for(const marker of ['Content-Security-Policy','sandbox="allow-scripts allow-same-origin allow-presentation"','referrerpolicy="no-referrer"','assets/js/app.js','id="toggle-compatibility"','id="switch-provider"']) if(!html.includes(marker)) throw new Error(`Missing required marker: ${marker}`);
if(/innerHTML\s*=/.test(await readFile(new URL('../assets/js/app.js',import.meta.url),'utf8'))) throw new Error('Unsafe innerHTML assignment found in app.js');
const vercel = JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
const pkg = JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
if (vercel.outputDirectory !== 'dist' || vercel.buildCommand !== 'npm run build:vercel' ||
    pkg.scripts['build:vercel'] !== 'npm run build && node scripts/catalogue-snapshot.mjs')
  throw new Error('Vercel configuration must build the embedded catalogue in dist/');
console.log('Static validation passed.');
