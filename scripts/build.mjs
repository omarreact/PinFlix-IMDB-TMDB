import { cp, mkdir, rm, stat } from 'node:fs/promises';
const out = new URL('../dist/', import.meta.url);
await rm(out,{recursive:true,force:true}); await mkdir(out,{recursive:true});
for (const item of ['index.html','404.html','manifest.webmanifest','sw.js','assets']) await cp(new URL(`../${item}`,import.meta.url),new URL(item,out),{recursive:true});
const info=await stat(new URL('index.html',out)); console.log(`Built dist/ (index.html ${info.size} bytes)`);
