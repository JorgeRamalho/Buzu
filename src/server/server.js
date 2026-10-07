const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.resolve(__dirname, '../..');
const CLIENT_DIR = path.join(ROOT, 'src', 'client');
const DATA_DIR = path.join(ROOT, 'data');
const USERS_FILE = process.env.VERCEL
  ? path.join('/tmp', 'buzzu-users.json')
  : path.join(DATA_DIR, 'users.json');
const TUBOS_FILE = path.join(DATA_DIR, 'tubos.json');
const LINHAS_FILE = path.join(DATA_DIR, 'linhas.json');
const { planRoute } = require('./routePlanner');
const { tryHandleMaps } = require('./mapsRoutes');
const SESSION_SECRET = process.env.SESSION_SECRET || 'development-only-change-me';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

loadEnv();
const demoStatus = {
  source: 'demo',
  updatedAt: new Date().toISOString(),
  operation: 'normal',
  arrivals: [
    { line: '203', name: 'Expresso Santa Cândida', stop: 'Tubo Rodoferroviária', direction: 'Sentido norte', minutes: 3 },
    { line: '303', name: 'Centenário / Campo Comprido', stop: 'Tubo Praça Rui Barbosa', direction: 'Plataforma 2', minutes: 7 },
    { line: '372', name: 'Augusto Stresser', stop: 'Estação Centro Cívico', direction: 'Sentido bairro', minutes: 12 },
    { line: '022', name: 'Interbairros II', stop: 'Tubo Passeio Público', direction: 'Sentido sul', minutes: 16 }
  ]
};

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}
function ensureData() {
  if (!process.env.VERCEL && !fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
}
function users() { ensureData(); return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
function saveUsers(value) { ensureData(); fs.writeFileSync(USERS_FILE, JSON.stringify(value, null, 2)); }
function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    ...headers,
  });
  res.end(JSON.stringify(body));
}
function readBody(req) { return new Promise((resolve, reject) => { let value = ''; req.on('data', chunk => { value += chunk; if (value.length > 1e6) req.destroy(); }); req.on('end', () => { try { resolve(value ? JSON.parse(value) : {}); } catch { reject(new Error('JSON inválido')); } }); req.on('error', reject); }); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, derived) => error ? reject(error) : resolve(`${salt}:${derived.toString('hex')}`))); }
function verifyPassword(password, stored) { const [salt, hash] = stored.split(':'); return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, derived) => { if (error) return reject(error); resolve(crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derived)); })); }
function tokenFor(user) { const payload = Buffer.from(JSON.stringify({ sub: user.id, email: user.email, exp: Date.now() + 86400000 })).toString('base64url'); const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url'); return `${payload}.${signature}`; }
function currentUser(req) { const value = req.headers.authorization?.replace('Bearer ', ''); if (!value) return null; const [payload, signature] = value.split('.'); if (!payload || !signature) return null; const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url'); if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null; try { const data = JSON.parse(Buffer.from(payload, 'base64url')); if (data.exp < Date.now()) return null; return users().find(user => user.id === data.sub) || null; } catch { return null; } }
async function fetchUrbs(url, headers = {}) { if (!url) return null; const response = await fetch(url, { headers, signal: AbortSignal.timeout(5000) }); if (!response.ok) throw new Error(`URBS respondeu ${response.status}`); return response.json(); }
function normalizeStopList(data) {
  const list = data?.stops || data?.tubos || data?.pontos || data?.items || data?.data || [];
  if (!Array.isArray(list)) return [];
  return list.map((item, index) => ({
    id: String(item.id || item.codigo || item.code || `stop-${index}`),
    name: String(item.name || item.nome || item.descricao || '').trim(),
    address: String(item.address || item.endereco || item.logradouro || '').trim(),
    district: String(item.district || item.bairro || item.regiao || '').trim(),
    lat: Number.isFinite(Number(item.lat ?? item.latitude)) ? Number(item.lat ?? item.latitude) : undefined,
    lon: Number.isFinite(Number(item.lon ?? item.longitude)) ? Number(item.lon ?? item.longitude) : undefined,
    platforms: Number(item.platforms || item.plataformas) || null,
    kind: item.kind || (String(item.name || item.nome || '').toLowerCase().includes('estação') ? 'estacao' : 'tubo')
  })).filter(stop => stop.name);
}
function loadLocalStops() {
  ensureData();
  if (!fs.existsSync(TUBOS_FILE)) return [];
  try {
    return normalizeStopList(JSON.parse(fs.readFileSync(TUBOS_FILE, 'utf8')));
  } catch {
    return [];
  }
}
function localStopsUpdatedAt() {
  if (!fs.existsSync(TUBOS_FILE)) return new Date().toISOString();
  try {
    return JSON.parse(fs.readFileSync(TUBOS_FILE, 'utf8')).updatedAt || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}
function normalizeLineList(data) {
  const list = data?.lines || data?.linhas || data?.vehicles || data?.data || [];
  if (!Array.isArray(list)) return [];
  return list.map((item, index) => {
    const name = String(item.name || item.nome || item.descricao || '').trim();
    const parts = name.includes('/') ? name.split('/').map(part => part.trim()) : [];
    const itinerary = Array.isArray(item.itinerary)
      ? item.itinerary.map(String)
      : Array.isArray(item.itinerario)
        ? item.itinerario.map(String)
        : [];
    return {
      code: String(item.code || item.codigo || item.numero || item.line || `line-${index}`).trim(),
      name,
      origin: String(item.origin || item.origem || parts[0] || '').trim(),
      destination: String(item.destination || item.destino || parts[1] || '').trim(),
      itinerary,
      terminus: String(item.terminus || item.terminal || item.stop || '').trim(),
      operator: String(item.operator || item.operadora || 'URBS').trim()
    };
  }).filter(line => line.code && line.name);
}
function loadLocalLines() {
  ensureData();
  if (!fs.existsSync(LINHAS_FILE)) return [];
  try {
    return normalizeLineList(JSON.parse(fs.readFileSync(LINHAS_FILE, 'utf8')));
  } catch {
    return [];
  }
}
function localLinesUpdatedAt() {
  if (!fs.existsSync(LINHAS_FILE)) return new Date().toISOString();
  try {
    return JSON.parse(fs.readFileSync(LINHAS_FILE, 'utf8')).updatedAt || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}
async function transitLines() {
  const authHeaders = process.env.URBS_API_KEY ? { Authorization: `Bearer ${process.env.URBS_API_KEY}` } : {};
  const urls = [process.env.URBS_LINES_URL, process.env.URBS_SCHEDULE_URL].filter(Boolean);
  for (const url of urls) {
    try {
      const data = await fetchUrbs(url, authHeaders);
      const lines = normalizeLineList(data);
      if (lines.length) {
        return { source: 'urbs', updatedAt: new Date().toISOString(), lines };
      }
    } catch {
      // tenta a próxima URL configurada
    }
  }
  const lines = loadLocalLines();
  return {
    source: 'local',
    updatedAt: localLinesUpdatedAt(),
    lines,
    warning: urls.length ? 'Fonte URBS indisponível ou incompatível; exibindo base local do Buzzu.' : undefined
  };
}
async function reverseGeocode(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Coordenadas inválidas');
  }
  const endpoint = new URL('https://nominatim.openstreetmap.org/reverse');
  endpoint.searchParams.set('lat', String(latitude));
  endpoint.searchParams.set('lon', String(longitude));
  endpoint.searchParams.set('format', 'json');
  endpoint.searchParams.set('accept-language', 'pt-BR');
  const response = await fetch(endpoint, {
    headers: { 'User-Agent': 'Buzzu/1.0 (+https://localhost)' },
    signal: AbortSignal.timeout(6000)
  });
  if (!response.ok) throw new Error('Geocodificação indisponível');
  const data = await response.json();
  const address = data.address || {};
  const label = [
    address.road || address.pedestrian || address.neighbourhood,
    address.suburb || address.city_district,
    'Curitiba'
  ].filter(Boolean).join(', ');
  return {
    label: label || data.display_name || 'Minha localização atual',
    latitude,
    longitude
  };
}
async function transitStops() {
  const authHeaders = process.env.URBS_API_KEY ? { Authorization: `Bearer ${process.env.URBS_API_KEY}` } : {};
  try {
    const data = await fetchUrbs(process.env.URBS_STOPS_URL, authHeaders);
    const stops = normalizeStopList(data);
    if (!stops.length) throw new Error('Resposta URBS sem pontos normalizados');
    return { source: 'urbs', updatedAt: new Date().toISOString(), stops };
  } catch (error) {
    const stops = loadLocalStops();
    return {
      source: 'local',
      updatedAt: localStopsUpdatedAt(),
      stops,
      warning: process.env.URBS_STOPS_URL ? 'Fonte URBS indisponível ou incompatível; exibindo base local do Buzzu.' : undefined
    };
  }
}
async function transitStatus() {
  try {
    const data = await fetchUrbs(process.env.URBS_REALTIME_URL, process.env.URBS_API_KEY ? { Authorization: `Bearer ${process.env.URBS_API_KEY}` } : {});
    const arrivals = Array.isArray(data?.arrivals) ? data.arrivals : [];
    if (!arrivals.length) throw new Error('Resposta sem chegadas normalizadas');
    return { source: 'urbs', updatedAt: new Date().toISOString(), ...data, arrivals };
  } catch (error) {
    return { ...demoStatus, warning: process.env.URBS_REALTIME_URL ? 'Fonte URBS indisponível ou incompatível; exibindo demonstração.' : 'Configure URBS_REALTIME_URL após obter acesso oficial.' };
  }
}
function serveStatic(req, res, pathname) { const file = pathname === '/' ? 'index.html' : pathname.slice(1); const safe = path.normalize(file).replace(/^\.\.(?:[\\/]|$)/, ''); const rootTarget = path.join(ROOT, safe); const clientTarget = path.join(CLIENT_DIR, safe); const target = pathname === '/' || fs.existsSync(rootTarget) ? rootTarget : clientTarget; const base = target === rootTarget ? ROOT : CLIENT_DIR; const relative = path.relative(base, target); if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) return send(res, 404, { error: 'Não encontrado' }); const ext = path.extname(target); const contentType = MIME[ext] || 'application/octet-stream'; let cacheHeader; if (ext === '.html') { cacheHeader = 'no-store, no-cache, must-revalidate, max-age=0, proxy-revalidate'; } else if (ext === '.css' || ext === '.js') { cacheHeader = 'no-cache, max-age=60, must-revalidate'; } else { cacheHeader = 'public, max-age=3600'; } const stat = fs.statSync(target); const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`; const reqEtag = req.headers['if-none-match']; if (reqEtag === etag) { res.writeHead(304, { 'Cache-Control': cacheHeader, 'ETag': etag }); return res.end(); } res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheHeader, 'Pragma': ext === '.html' ? 'no-cache' : '', 'Expires': ext === '.html' ? '0' : '', 'ETag': etag, 'Last-Modified': stat.mtime.toUTCString() }); fs.createReadStream(target).pipe(res); }

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/api/health') {
      return send(res, 200, {
        ok: true,
        service: 'buzu-api',
        mode: process.env.PAYMENT_PROVIDER || 'mock',
        commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
        branch: process.env.VERCEL_GIT_COMMIT_REF || null,
        build: process.env.BUZZU_BUILD_ID || null,
      });
    }
    if (url.pathname === '/api/transit/status' && req.method === 'GET') return send(res, 200, await transitStatus());
    if (url.pathname === '/api/transit/lines' && req.method === 'GET') return send(res, 200, await transitLines());
    if (url.pathname === '/api/transit/stops' && req.method === 'GET') return send(res, 200, await transitStops());
    if (url.pathname === '/api/routes/plan' && req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return res.end();
    }
    if (url.pathname === '/api/routes/plan' && req.method === 'POST') {
      const body = await readBody(req);
      const from = String(body.from || '').trim();
      const to = String(body.to || '').trim();
      let originLatLng = null;
      if (body.originLatLng && typeof body.originLatLng === 'object') {
        originLatLng = {
          lat: Number(body.originLatLng.lat),
          lon: Number(body.originLatLng.lon),
        };
      } else if (typeof body.originLatLng === 'string' && body.originLatLng.includes(',')) {
        const [lat, lon] = body.originLatLng.split(',').map(Number);
        if (Number.isFinite(lat) && Number.isFinite(lon)) originLatLng = { lat, lon };
      }
      if ((!from && !originLatLng) || !to) {
        return send(res, 400, { error: 'Informe origem e destino.' });
      }
      const [linesPayload, stopsPayload] = await Promise.all([transitLines(), transitStops()]);
      try {
        const plan = planRoute({
          from,
          to,
          originLatLng,
          lines: linesPayload.lines,
          stops: stopsPayload.stops,
          sourceMeta: linesPayload,
        });
        return send(res, 200, plan);
      } catch (error) {
        return send(res, 400, { error: error.message || 'Não foi possível montar a rota.' });
      }
    }
    if (await tryHandleMaps(url, req, res, send, readBody)) return;
    if (url.pathname === '/api/geo/reverse' && req.method === 'GET') {
      try {
        return send(res, 200, await reverseGeocode(url.searchParams.get('lat'), url.searchParams.get('lon')));
      } catch (error) {
        return send(res, 502, { error: 'Não foi possível identificar o endereço da localização.' });
      }
    }
    if (url.pathname === '/api/auth/register' && req.method === 'POST') {
      const body = await readBody(req); const email = String(body.email || '').trim().toLowerCase(); const name = String(body.name || '').trim(); const password = String(body.password || '');
      if (!name || !email || password.length < 8) return send(res, 400, { error: 'Informe nome, e-mail e uma senha com pelo menos 8 caracteres.' });
      const list = users(); if (list.some(user => user.email === email)) return send(res, 409, { error: 'Este e-mail já está cadastrado.' });
      const user = { id: crypto.randomUUID(), name, email, passwordHash: await hashPassword(password), createdAt: new Date().toISOString(), card: { status: 'not_connected' } }; list.push(user); saveUsers(list);
      return send(res, 201, { token: tokenFor(user), user: { id: user.id, name, email } });
    }
    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await readBody(req); const user = users().find(item => item.email === String(body.email || '').trim().toLowerCase());
      if (!user || !(await verifyPassword(String(body.password || ''), user.passwordHash))) return send(res, 401, { error: 'E-mail ou senha inválidos.' });
      return send(res, 200, { token: tokenFor(user), user: { id: user.id, name: user.name, email: user.email } });
    }
    if (url.pathname === '/api/account' && req.method === 'GET') { const user = currentUser(req); if (!user) return send(res, 401, { error: 'Autenticação necessária.' }); return send(res, 200, { id: user.id, name: user.name, email: user.email, card: user.card }); }
    if (url.pathname === '/api/card/balance' && req.method === 'GET') { const user = currentUser(req); if (!user) return send(res, 401, { error: 'Autenticação necessária.' }); return send(res, 200, { source: 'not_connected', message: 'O saldo real depende da integração autorizada com o Cartão Transporte URBS.', balance: null }); }
    if (url.pathname === '/api/payments/checkout' && req.method === 'POST') { const user = currentUser(req); if (!user) return send(res, 401, { error: 'Autenticação necessária.' }); const body = await readBody(req); const amount = Number(body.amount); if (!Number.isFinite(amount) || amount < 1 || amount > 1000) return send(res, 400, { error: 'Valor deve estar entre R$ 1 e R$ 1.000.' }); return send(res, 201, { provider: process.env.PAYMENT_PROVIDER || 'mock', status: 'pending', checkoutUrl: null, message: 'Configure o provedor de pagamento para gerar o checkout real.', amount, userId: user.id }); }
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Rota de API não encontrada.' });
    return serveStatic(req, res, url.pathname);
  } catch (error) { console.error(error); send(res, 500, { error: 'Erro interno do servidor.' }); }
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) send(res, 500, { error: 'Erro interno do servidor.' });
  });
});

ensureData();
if (require.main === module) {
  server.listen(PORT, () => console.log(`Buzu em http://localhost:${PORT}`));
}

module.exports = { handleRequest, server, PORT };
