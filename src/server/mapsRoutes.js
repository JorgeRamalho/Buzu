const OSRM_BASE = (process.env.OSRM_BASE_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
const CURITIBA_BOUNDS = { south: -25.75, north: -25.25, west: -49.55, east: -49.05 };

function googleMapsKey() {
  return String(process.env.GOOGLE_MAPS_API_KEY || '').trim();
}

function mapsConfigPayload() {
  const key = googleMapsKey();
  return {
    googleMaps: Boolean(key),
    browserKey: key || null,
    directions: Boolean(key),
    osrm: true,
    billing: key ? 'key_configured' : 'awaiting_google_cloud_key',
  };
}

function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  const value = String(encoded || '');

  while (index < value.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;
    do {
      byte = value.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < value.length);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    shift = 0;
    result = 0;
    do {
      byte = value.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < value.length);
    lon += (result & 1) ? ~(result >> 1) : (result >> 1);

    points.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }

  return points;
}

function isNearCuritiba(lat, lon) {
  return Number.isFinite(lat)
    && Number.isFinite(lon)
    && lat >= CURITIBA_BOUNDS.south
    && lat <= CURITIBA_BOUNDS.north
    && lon >= CURITIBA_BOUNDS.west
    && lon <= CURITIBA_BOUNDS.east;
}

function normalizeCoordinates(raw) {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 20) return null;
  const coordinates = raw.map((point) => ({
    lat: Number(point?.lat),
    lon: Number(point?.lon),
  }));
  if (coordinates.some((point) => !isNearCuritiba(point.lat, point.lon))) return null;
  return coordinates;
}

function parseLatLngParam(value) {
  const [lat, lon] = String(value || '').split(',').map(Number);
  if (!isNearCuritiba(lat, lon)) return null;
  return { lat, lon };
}

async function fetchOsrmPath(profile, coordinates) {
  const mode = profile === 'foot' ? 'foot' : 'driving';
  const path = coordinates.map((point) => `${point.lon},${point.lat}`).join(';');
  const endpoint = `${OSRM_BASE}/route/v1/${mode}/${path}?overview=full&geometries=geojson&steps=false`;
  const response = await fetch(endpoint, {
    headers: { 'User-Agent': 'Buzzu/1.0 (Curitiba transit map)' },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const geometry = data?.routes?.[0]?.geometry?.coordinates;
  if (data?.code !== 'Ok' || !Array.isArray(geometry) || geometry.length < 2) return null;
  return geometry.map(([lon, lat]) => ({ lat, lon }));
}

async function fetchGoogleDirections(origin, destination) {
  const key = googleMapsKey();
  if (!key) return { available: false, status: 'MISSING_KEY', path: [] };

  const endpoint = new URL('https://maps.googleapis.com/maps/api/directions/json');
  endpoint.searchParams.set('origin', `${origin.lat},${origin.lon}`);
  endpoint.searchParams.set('destination', `${destination.lat},${destination.lon}`);
  endpoint.searchParams.set('mode', 'transit');
  endpoint.searchParams.set('language', 'pt-BR');
  endpoint.searchParams.set('region', 'br');
  endpoint.searchParams.set('key', key);

  const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
  const data = await response.json();
  if (data.status !== 'OK' || !data.routes?.[0]) {
    return { available: true, status: data.status || 'UNKNOWN', path: [], summary: '' };
  }

  const route = data.routes[0];
  const path = decodePolyline(route.overview_polyline?.points || '');
  const steps = (route.legs || []).flatMap((leg) => (leg.steps || []).map((step) => ({
    travelMode: step.travel_mode,
    instructions: String(step.html_instructions || '').replace(/<[^>]+>/g, ''),
    line: step.transit_details?.line?.short_name || null,
    lineName: step.transit_details?.line?.name || null,
  })));

  return {
    available: true,
    status: 'OK',
    summary: route.summary || '',
    path,
    steps,
  };
}

async function tryHandleMaps(url, req, res, send, readBody) {
  if (url.pathname === '/api/maps/config' && req.method === 'GET') {
    send(res, 200, mapsConfigPayload());
    return true;
  }

  if (url.pathname === '/api/maps/osrm' && req.method === 'POST') {
    const body = await readBody(req);
    const profile = body.profile === 'foot' ? 'foot' : 'driving';
    const coordinates = normalizeCoordinates(body.coordinates);
    if (!coordinates) {
      send(res, 400, { error: 'Coordenadas inválidas para o traçado.' });
      return true;
    }
    try {
      const path = await fetchOsrmPath(profile, coordinates);
      if (!path) {
        send(res, 200, { path: [] });
        return true;
      }
      send(res, 200, { path });
    } catch {
      send(res, 200, { path: [] });
    }
    return true;
  }

  if (url.pathname === '/api/maps/directions' && req.method === 'GET') {
    const origin = parseLatLngParam(url.searchParams.get('origin'));
    const destination = parseLatLngParam(url.searchParams.get('destination'));
    if (!origin || !destination) {
      send(res, 400, { error: 'Informe origem e destino válidos em Curitiba.' });
      return true;
    }
    try {
      send(res, 200, await fetchGoogleDirections(origin, destination));
    } catch {
      send(res, 200, { available: Boolean(googleMapsKey()), status: 'ERROR', path: [] });
    }
    return true;
  }

  return false;
}

module.exports = {
  tryHandleMaps,
  decodePolyline,
  mapsConfigPayload,
  normalizeCoordinates,
};
