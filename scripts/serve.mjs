import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Serve the compiled site, including its embedded catalogue, after npm run build.
const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const args = process.argv.slice(2);
const named = args.find(arg => arg.startsWith('--port='));
const flag = args.indexOf('--port');
const port = Number(named?.split('=')[1] ?? (flag >= 0 ? args[flag + 1] : 4173));
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json; charset=utf-8'
};
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname.endsWith('/') ? pathname + 'index.html' : pathname;
    const file = resolve(root, '.' + relative);
    if (!file.startsWith(root + sep)) throw new Error('Invalid path');
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found. Run npm run build first.');
  }
}).listen(port, '127.0.0.1', () => console.log(`PinFlix built site: http://127.0.0.1:${port}`));
