const test = require('node:test');
const assert = require('node:assert/strict');
const { decodePolyline, mapsConfigPayload, normalizeCoordinates } = require('../src/server/mapsRoutes');

test('polyline do Google Directions decodifica dois pontos', () => {
  const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  assert.ok(points.length >= 2);
  assert.ok(Math.abs(points[0].lat - 38.5) < 0.01);
  assert.ok(Math.abs(points[0].lon - (-120.2)) < 0.01);
});

test('config de mapas não inventa chave quando a variável está vazia', () => {
  const previous = process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;
  const config = mapsConfigPayload();
  assert.equal(config.googleMaps, false);
  assert.equal(config.browserKey, null);
  assert.equal(config.directions, false);
  assert.equal(config.osrm, true);
  if (previous) process.env.GOOGLE_MAPS_API_KEY = previous;
});

test('OSRM recusa coordenada fora de Curitiba', () => {
  assert.equal(normalizeCoordinates([
    { lat: -23.55, lon: -46.63 },
    { lat: -25.42, lon: -49.27 },
  ]), null);
  const local = normalizeCoordinates([
    { lat: -25.4284, lon: -49.2733 },
    { lat: -25.4145, lon: -49.2445 },
  ]);
  assert.equal(local.length, 2);
});
