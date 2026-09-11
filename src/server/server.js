const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.resolve(__dirname, '../..');
const CLIENT_DIR = path.join(ROOT, 'src', 'client');
const DATA_DIR = path.join(ROOT, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
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
function ensureData() { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]'); }
function users() { ensureData(); return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
function saveUsers(value) { ensureData(); fs.writeFileSync(USERS_FILE, JSON.stringify(value, null, 2)); }
function send(res, status, body, headers = {}) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers }); res.end(JSON.stringify(body)); }
function readBody(req) { return new Promise((resolve, reject) => { let value = ''; req.on('data', chunk => { value += chunk; if (value.length > 1e6) req.destroy(); }); req.on('end', () => { try { resolve(value ? JSON.parse(value) : {}); } catch { reject(new Error('JSON inválido')); } }); req.on('error', reject); }); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, derived) => error ? reject(error) : resolve(`${salt}:${derived.toString('hex')}`))); }
function verifyPassword(password, stored) { const [salt, hash] = stored.split(':'); return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, derived) => { if (error) return reject(error); resolve(crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derived)); })); }
function tokenFor(user) { const payload = Buffer.from(JSON.stringify({ sub: user.id, email: user.email, exp: Date.now() + 86400000 })).toString('base64url'); const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url'); return `${payload}.${signature}`; }
function currentUser(req) { const value = req.headers.authorization?.replace('Bearer ', ''); if (!value) return null; const [payload, signature] = value.split('.'); if (!payload || !signature) return null; const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url'); if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null; try { const data = JSON.parse(Buffer.from(payload, 'base64url')); if (data.exp < Date.now()) return null; return users().find(user => user.id === data.sub) || null; } catch { return null; } }
async function fetchUrbs(url, headers = {}) { if (!url) return null; const response = await fetch(url, { headers, signal: AbortSignal.timeout(5000) }); if (!response.ok) throw new Error(`URBS respondeu ${response.status}`); return response.json(); }
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
function serveStatic(req, res, pathname) { const file = pathname === '/' ? 'index.html' : pathname.slice(1); const safe = path.normalize(file).replace(/^\.\.(?:[\\/]|$)/, ''); const rootTarget = path.join(ROOT, safe); const clientTarget = path.join(CLIENT_DIR, safe); const target = pathname === '/' || fs.existsSync(rootTarget) ? rootTarget : clientTarget; const base = target === rootTarget ? ROOT : CLIENT_DIR; const relative = path.relative(base, target); if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) return send(res, 404, { error: 'Não encontrado' }); res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream' }); fs.createReadStream(target).pipe(res); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/api/health') return send(res, 200, { ok: true, service: 'buzu-api', mode: process.env.PAYMENT_PROVIDER || 'mock' });
    if (url.pathname === '/api/transit/status' && req.method === 'GET') return send(res, 200, await transitStatus());
    if (url.pathname === '/api/transit/lines' && req.method === 'GET') {
      const data = await fetchUrbs(process.env.URBS_SCHEDULE_URL, process.env.URBS_API_KEY ? { Authorization: `Bearer ${process.env.URBS_API_KEY}` } : {}).catch(() => null);
      return send(res, 200, data || { source: 'demo', lines: demoStatus.arrivals.map(item => ({ code: item.line, name: item.name })) });
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
});

ensureData();
server.listen(PORT, () => console.log(`Buzu em http://localhost:${PORT}`));
