import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import worker from './worker.js';

const root = resolve(import.meta.dirname, '../public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };
const assets = { async fetch(request) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url).pathname); } catch { return new Response('Bad request', { status: 400 }); }
  const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(root + sep)) return new Response('Forbidden', { status: 403 });
  try { return new Response(await readFile(file), { headers: { 'Content-Type': types[extname(file)] || 'application/octet-stream' } }); }
  catch { return new Response('Not found', { status: 404 }); }
} };
const headers = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
};
const server = createServer(async (req, res) => {
  try {
    const abort = new AbortController(); let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 32000) { res.writeHead(413); res.end('Payload too large'); abort.abort(); return; } chunks.push(chunk); }
    const request = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) });
    const response = await worker.fetch(request, { ASSETS: assets });
    res.writeHead(response.status, { ...headers, ...Object.fromEntries(response.headers) });
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end('Internal server error'); }
});
const port = Number(process.env.PORT || 4173);
server.listen(port, '127.0.0.1', () => console.log(`プロンプトラボ: http://127.0.0.1:${port}`));
