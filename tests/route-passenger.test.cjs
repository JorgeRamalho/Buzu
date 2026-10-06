const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');

const { validateRouteSearch, pickRouteLines } = require('../scripts/lib/routeSearch.cjs');

const ROOT = path.join(__dirname, '..');
const stops = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tubos.json'), 'utf8')).stops;
const lines = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/linhas.json'), 'utf8')).lines;

const BASE = process.env.BUZU_TEST_URL || 'http://127.0.0.1:3000';

function fetchJson(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${urlPath}`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(body) });
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

/** Viagens simuladas entre tubos e pontos de Curitiba. */
const simulatedJourneys = [
  ['Tubo Rodoferroviária', 'Tubo Jardim Botânico'],
  ['Tubo Praça Rui Barbosa', 'Tubo Batel'],
  ['Tubo Centro Cívico', 'Tubo Pinheirinho'],
  ['Tubo Rebouças', 'Tubo Boqueirão'],
  ['Tubo Santa Felicidade', 'Tubo Portão'],
  ['Tubo Cajuru', 'Tubo Sítio Cercado'],
  ['Estação Cabral', 'Tubo Água Verde'],
  ['Tubo Capão Raso', 'Tubo Tatuquara'],
  ['Tubo Mercês', 'Tubo Hugo Lange'],
  ['Tubo Guadalupe', 'Tubo Xaxim'],
];

test('validação rejeita origem/destino inválidos', () => {
  assert.equal(validateRouteSearch({ from: '', to: 'Tubo Batel', hasOriginCoords: false }), 'Informe origem e destino para calcular sua rota.');
  assert.equal(validateRouteSearch({ from: 'Tubo Batel', to: 'Tubo Batel', hasOriginCoords: false }), 'Escolha pontos diferentes para calcular sua rota.');
  assert.equal(validateRouteSearch({ from: 'ab', to: 'Tubo Batel', hasOriginCoords: false }), 'Digite uma origem mais completa ou use sua localização.');
  assert.equal(validateRouteSearch({ from: 'Tubo Rodoferroviária', to: 'xy', hasOriginCoords: false }), 'Digite um destino mais completo.');
  assert.equal(validateRouteSearch({ from: '', to: 'Tubo Batel', hasOriginCoords: true }), null);
});

test('tubos cadastrados têm nomes válidos para busca', () => {
  assert.ok(stops.length >= 30, 'esperado catálogo amplo de tubos');
  for (const stop of stops) {
    assert.ok(stop.name.length >= 3, `nome curto: ${stop.name}`);
    assert.ok(stop.district, `bairro ausente: ${stop.name}`);
  }
});

test('viagens simuladas passam na validação', () => {
  const stopNames = new Set(stops.map((s) => s.name));
  for (const [from, to] of simulatedJourneys) {
    assert.ok(stopNames.has(from), `origem desconhecida: ${from}`);
    assert.ok(stopNames.has(to), `destino desconhecido: ${to}`);
    assert.equal(validateRouteSearch({ from, to, hasOriginCoords: false }), null, `${from} → ${to}`);
    const picked = pickRouteLines(lines, from.length + to.length);
    assert.equal(picked.length, 3);
    for (const line of picked) {
      assert.ok(line.code && line.name && line.origin && line.destination, `linha incompleta ${line.code}`);
    }
  }
});

test('Hugo Lange → Juvevê gera traçado com pontos distintos (linha 560)', async () => {
  const payload = JSON.stringify({ from: 'Tubo Hugo Lange', to: 'Juvevê' });
  const result = await new Promise((resolve, reject) => {
    const req = http.request(`${BASE}/api/routes/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
  assert.equal(result.status, 200);
  const recommended = result.json.options[0];
  const transit = recommended.steps.find((step) => step.type === 'transit');
  assert.ok(transit, 'deve existir trecho de ônibus');
  assert.ok(transit.path.length >= 2, 'polyline deve ter ao menos 2 pontos');
  const { lat: oLat, lon: oLon } = result.json.origin;
  const { lat: dLat, lon: dLon } = result.json.destination;
  assert.ok(Math.abs(oLat - dLat) + Math.abs(oLon - dLon) > 0.001, 'origem e destino não podem coincidir');
});

test('API de planejamento monta rota com mapa e etapas', async () => {
  const payload = JSON.stringify({
    from: 'Tubo Rodoferroviária',
    to: 'Tubo Jardim Botânico',
  });
  const result = await new Promise((resolve, reject) => {
    const req = http.request(`${BASE}/api/routes/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.json.options) && result.json.options.length === 3);
  const first = result.json.options[0];
  assert.ok(first.steps.length >= 2);
  assert.ok(first.steps.some((step) => step.type === 'transit' && step.path?.length));
  assert.ok(first.bounds?.north && first.bounds?.south);
});

test('API de linhas e tubos responde (servidor local)', async () => {
  const linesRes = await fetchJson('/api/transit/lines');
  assert.equal(linesRes.status, 200);
  assert.ok(Array.isArray(linesRes.json.lines));
  assert.ok(linesRes.json.lines.length >= 40);

  const stopsRes = await fetchJson('/api/transit/stops');
  assert.equal(stopsRes.status, 200);
  assert.ok(Array.isArray(stopsRes.json.stops));
  assert.ok(stopsRes.json.stops.length >= 30);
});
