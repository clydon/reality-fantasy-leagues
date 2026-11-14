// Serve a local screenshot inventory. Read-only; loopback only; no app/database access.
//   node scripts/dev-test/serve-captures.js captures/own-pace-2026-11-10 [--port=4300]
const http = require('http');
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
if (!args[0] || args[0].startsWith('--')) throw new Error('Provide a capture directory');
const root = fs.realpathSync(args[0]);
const port = Number(args.find(a => a.startsWith('--port='))?.slice(7) || 4300);
const types = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  let file;
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    file = fs.realpathSync(path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname)));
  } catch { res.writeHead(404).end(); return; }
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
  if (!fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Screenshot gallery: http://127.0.0.1:${port}`));
