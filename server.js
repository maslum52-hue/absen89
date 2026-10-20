const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const root = __dirname;
const lanAdapters = Object.entries(os.networkInterfaces()).flatMap(([name, entries]) => (entries || []).filter(entry => !entry.internal && (entry.family === 'IPv4' || entry.family === 4)).map(entry => ({ name, address: entry.address })));
lanAdapters.sort((a, b) => Number(/wi-?fi|wireless|ethernet/i.test(b.name)) - Number(/wi-?fi|wireless|ethernet/i.test(a.name)));
const lanBaseUrl = lanAdapters[0] ? `http://${lanAdapters[0].address}:8000` : '';
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname === '/app-config.js') {
    res.writeHead(200, { 'Content-Type': mime['.js'], 'Cache-Control': 'no-store' });
    res.end(`window.HADIR_BASE_URL=${JSON.stringify(lanBaseUrl)};`);
    return;
  }
  const requested = pathname === '/' || /^\/QR-HADIR-\d{8}$/i.test(pathname) ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(root, requested);
  if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(err.code === 'ENOENT' ? 404 : 500); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(8000, '0.0.0.0', () => console.log(`Hadir berjalan di http://localhost:8000${lanBaseUrl ? ` dan ${lanBaseUrl}` : ''}`));
