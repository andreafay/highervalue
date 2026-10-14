const http = require('http');
const fs = require('fs');
const path = require('path');
const build = require('./scripts/build-players');
const { pairResponse, guessResponse } = require('./lib/game');

const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data', 'players.json');
const PUBLIC = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

let players = [];
let byId = new Map();

function load() {
  players = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  byId = new Map(players.map((p) => [p.id, p]));
  console.log(`Loaded ${players.length} players`);
}

const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 10_000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/pair') {
    const { status, body } = pairResponse(players, url.searchParams.get('exclude'));
    return send(res, status, body);
  }
  if (req.method === 'POST' && url.pathname === '/api/guess') {
    let input;
    try { input = await readBody(req); } catch { return send(res, 400, { error: 'Bad JSON' }); }
    const { status, body } = guessResponse(byId, input);
    return send(res, status, body);
  }
  send(res, 404, { error: 'Not found' });
}

function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

async function main() {
  if (!fs.existsSync(DATA)) await build();
  load();
  http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) handleApi(req, res, url).catch(() => send(res, 500, { error: 'Server error' }));
    else serveStatic(res, url.pathname);
  }).listen(PORT, () => console.log(`Higher Value running at http://localhost:${PORT}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
