import { access, readFile } from 'node:fs/promises';
const required=['index.html','manifest.webmanifest','sw.js','assets/css/styles.css','assets/js/app.js','assets/js/dev-config.js','assets/js/lib/validation.js','assets/js/services/storage.js','assets/js/services/tmdb.js','assets/js/services/providers.js','.github/workflows/pages.yml'];
for(const file of required) await access(new URL(`../${file}`,import.meta.url));
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
for(const marker of ['Content-Security-Policy','sandbox="allow-scripts allow-same-origin allow-presentation"','referrerpolicy="no-referrer"','assets/js/app.js']) if(!html.includes(marker)) throw new Error(`Missing required marker: ${marker}`);
if(/innerHTML\s*=/.test(await readFile(new URL('../assets/js/app.js',import.meta.url),'utf8'))) throw new Error('Unsafe innerHTML assignment found in app.js');
console.log('Static validation passed.');
