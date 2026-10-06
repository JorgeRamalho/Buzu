const LINE_COLORS = {
  '101': '#459b70', '110': '#db5a4b', '172': '#4f82a0', '203': '#db5a4b', '208': '#c9a34b',
  '218': '#459b70', '222': '#4f82a0', '270': '#7b5ea7', '280': '#db5a4b', '290': '#459b70',
  '303': '#459b70', '311': '#c9a34b', '320': '#4f82a0', '335': '#db5a4b', '340': '#7b5ea7',
  '356': '#459b70', '372': '#4f82a0', '380': '#db5a4b', '390': '#c9a34b', '400': '#459b70',
  '414': '#4f82a0', '418': '#7b5ea7', '022': '#c9a34b', '023': '#db5a4b', '500': '#2e9e5b',
  '501': '#2e9e5b', '502': '#db5a4b', '503': '#459b70', '510': '#4f82a0', '520': '#7b5ea7',
  '530': '#c9a34b', '540': '#db5a4b', '550': '#459b70', '560': '#4f82a0', '570': '#7b5ea7',
  '580': '#c9a34b', '590': '#db5a4b', '600': '#459b70', '610': '#4f82a0', '620': '#7b5ea7',
  '630': '#c9a34b', '640': '#db5a4b', '650': '#459b70', '660': '#4f82a0', '670': '#7b5ea7',
  '680': '#c9a34b', '690': '#db5a4b', '700': '#459b70', '710': '#4f82a0', '720': '#7b5ea7',
};

const DISTRICT_COORDS = {
  Centro: [-25.4284, -49.2733],
  'Centro Cívico': [-25.4196, -49.2654],
  Batel: [-25.4417, -49.2892],
  Cabral: [-25.4056, -49.2536],
  Rebouças: [-25.4477, -49.2656],
  'Água Verde': [-25.4557, -49.2864],
  'Jardim Botânico': [-25.4422, -49.2404],
  Mercês: [-25.4320, -49.2945],
  Juvevê: [-25.4145, -49.2445],
  Ahú: [-25.4100, -49.2420],
  Guadalupe: [-25.4620, -49.2480],
  Boqueirão: [-25.5020, -49.2320],
  'Capão Raso': [-25.4880, -49.2980],
  Portão: [-25.4720, -49.2880],
  Pinheirinho: [-25.5180, -49.2680],
  'Santa Felicidade': [-25.3920, -49.3180],
  Cajuru: [-25.4680, -49.2480],
  'Boa Vista': [-25.3980, -49.2580],
  CIC: [-25.5280, -49.3280],
  'Sítio Cercado': [-25.5380, -49.2880],
  Uberaba: [-25.4880, -49.2180],
  Xaxim: [-25.5080, -49.3080],
  Tatuquara: [-25.4780, -49.3380],
  Tingui: [-25.3780, -49.3380],
  Fazendinha: [-25.4580, -49.3180],
  Orleans: [-25.4980, -49.2780],
  'Santa Cândida': [-25.3680, -49.2480],
  Atuba: [-25.3580, -49.2280],
  Bacacheri: [-25.3780, -49.2180],
  'Bairro Alto': [-25.4120, -49.2380],
  Seminário: [-25.4220, -49.2820],
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function pointFromStop(stop) {
  if (Number.isFinite(stop.lat) && Number.isFinite(stop.lon)) {
    return { lat: stop.lat, lon: stop.lon, label: stop.name, stopId: stop.id, kind: stop.kind || 'tubo' };
  }
  const district = DISTRICT_COORDS[stop.district];
  if (district) {
    return { lat: district[0], lon: district[1], label: stop.name, stopId: stop.id, kind: stop.kind || 'tubo' };
  }
  return { lat: -25.4284, lon: -49.2733, label: stop.name, stopId: stop.id, kind: stop.kind || 'tubo' };
}

function resolvePlace(query, stops, originLatLng) {
  if (originLatLng?.lat != null && originLatLng?.lon != null && !query) {
    return {
      lat: originLatLng.lat,
      lon: originLatLng.lon,
      label: 'Minha localização',
      source: 'gps',
    };
  }
  const normalized = normalizeText(query);
  if (!normalized) return null;

  for (const [district, coords] of Object.entries(DISTRICT_COORDS)) {
    const districtKey = normalizeText(district);
    if (normalized === districtKey || normalized === `bairro ${districtKey}` || normalized === `tubo ${districtKey}`) {
      return { lat: coords[0], lon: coords[1], label: query, source: 'district' };
    }
  }

  const stop = stops.find((item) => normalizeText(item.name) === normalized)
    || stops.find((item) => normalizeText(item.name).includes(normalized) || normalized.includes(normalizeText(item.name)));
  if (stop) return { ...pointFromStop(stop), source: 'stop' };

  for (const [district, coords] of Object.entries(DISTRICT_COORDS)) {
    if (normalized.includes(normalizeText(district))) {
      return { lat: coords[0], lon: coords[1], label: query, source: 'district' };
    }
  }

  return { lat: -25.4284, lon: -49.2733, label: query, source: 'fallback' };
}

function lineColor(code) {
  return LINE_COLORS[String(code)] || '#4285f4';
}

function matchItineraryStops(line, stops) {
  const names = Array.isArray(line.itinerary) && line.itinerary.length
    ? line.itinerary
    : [line.origin, line.terminus, line.destination].filter(Boolean);

  const mapped = [];
  for (const raw of names) {
    const key = normalizeText(raw);
    const districtExact = Object.entries(DISTRICT_COORDS).find(([name]) => key === normalizeText(name));
    if (districtExact) {
      mapped.push({ lat: districtExact[1][0], lon: districtExact[1][1], label: String(raw), kind: 'bairro' });
      continue;
    }
    const stop = stops.find((s) => normalizeText(s.name).includes(key) || key.includes(normalizeText(s.name)));
    if (stop) mapped.push(pointFromStop(stop));
    else {
      const district = Object.entries(DISTRICT_COORDS).find(([name]) => key.includes(normalizeText(name)));
      if (district) mapped.push({ lat: district[1][0], lon: district[1][1], label: String(raw), kind: 'referencia' });
    }
  }
  return mapped;
}

function sliceItineraryBetween(stopsOnLine, origin, destination) {
  if (!stopsOnLine.length) return [];
  let startIdx = 0;
  let endIdx = stopsOnLine.length - 1;
  let bestStart = Infinity;
  let bestEnd = Infinity;
  stopsOnLine.forEach((stop, index) => {
    const dStart = haversineKm(origin, stop);
    const dEnd = haversineKm(destination, stop);
    if (dStart < bestStart) { bestStart = dStart; startIdx = index; }
    if (dEnd < bestEnd) { bestEnd = dEnd; endIdx = index; }
  });
  if (startIdx <= endIdx) return stopsOnLine.slice(startIdx, endIdx + 1);
  return [...stopsOnLine.slice(startIdx), ...stopsOnLine.slice(0, endIdx + 1)];
}

function ensureDistinctEndpoints(origin, destination, minKm = 0.35) {
  if (haversineKm(origin, destination) >= minKm) return destination;
  return {
    ...destination,
    lat: destination.lat - 0.0035,
    lon: destination.lon + 0.0045,
  };
}

function normalizeMapBounds(points, padding = 0.01) {
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  let north = Math.max(...lats);
  let south = Math.min(...lats);
  let east = Math.max(...lons);
  let west = Math.min(...lons);
  const minSpan = 0.014;
  if (north - south < minSpan) {
    const mid = (north + south) / 2;
    north = mid + minSpan / 2;
    south = mid - minSpan / 2;
  }
  if (east - west < minSpan) {
    const mid = (east + west) / 2;
    east = mid + minSpan / 2;
    west = mid - minSpan / 2;
  }
  return {
    north: north + padding,
    south: south - padding,
    east: east + padding,
    west: west - padding,
  };
}

function interpolateWalk(from, to, points = 4) {
  const path = [];
  for (let i = 0; i <= points; i += 1) {
    const t = i / points;
    path.push({
      lat: from.lat + (to.lat - from.lat) * t,
      lon: from.lon + (to.lon - from.lon) * t,
    });
  }
  return path;
}

function pathFromStops(stops) {
  return stops.map((s) => ({ lat: s.lat, lon: s.lon }));
}

function estimateMinutes(distanceKm, mode) {
  if (mode === 'walk') return Math.max(2, Math.round(distanceKm / 0.08));
  return Math.max(5, Math.round(distanceKm / 0.35));
}

function buildOption(id, label, origin, destination, lines, stops, walkMinutes, transfers) {
  const steps = [];
  let cursor = { lat: origin.lat, lon: origin.lon };
  let totalMinutes = 0;

  lines.forEach((line, lineIndex) => {
    const onLine = sliceItineraryBetween(matchItineraryStops(line, stops), origin, destination);
    const board = onLine[0] || destination;
    const walkToBoard = haversineKm(cursor, board);
    const walkMin = lineIndex === 0 ? Math.max(2, walkMinutes) : Math.max(3, Math.round(walkToBoard / 0.08));
    if (walkMin > 0) {
      steps.push({
        type: 'walk',
        minutes: walkMin,
        label: lineIndex === 0 ? `Caminhar até embarque · ${board.label}` : `Baldeação a pé · ${board.label}`,
        path: interpolateWalk(cursor, board),
      });
      totalMinutes += walkMin;
    }
    const alight = onLine[onLine.length - 1] || board;
    const ridePath = onLine.length > 1 ? pathFromStops(onLine) : interpolateWalk(board, alight, 6);
    const rideKm = ridePath.reduce((acc, point, idx) => {
      if (idx === 0) return acc;
      return acc + haversineKm(ridePath[idx - 1], point);
    }, 0);
    const rideMin = estimateMinutes(rideKm, 'transit');
    steps.push({
      type: 'transit',
      minutes: rideMin,
      lineCode: line.code,
      lineName: line.name,
      color: lineColor(line.code),
      operator: line.operator || 'URBS',
      label: `Linha ${line.code} · ${line.name}`,
      stops: onLine.map((s) => s.label),
      path: ridePath,
    });
    totalMinutes += rideMin;
    cursor = { lat: alight.lat, lon: alight.lon };
  });

  const walkEndKm = haversineKm(cursor, destination);
  const walkEndMin = Math.max(2, Math.round(walkEndKm / 0.08));
  steps.push({
    type: 'walk',
    minutes: walkEndMin,
    label: `Caminhar até ${destination.label}`,
    path: interpolateWalk(cursor, destination),
  });
  totalMinutes += walkEndMin;

  let allPoints = steps.flatMap((s) => s.path);
  if (!allPoints.length) {
    allPoints = [
      { lat: origin.lat, lon: origin.lon },
      { lat: destination.lat, lon: destination.lon },
    ];
  }
  const lats = allPoints.map((p) => p.lat);
  const lons = allPoints.map((p) => p.lon);

  const bounds = normalizeMapBounds(allPoints);

  return {
    id,
    label,
    timeMinutes: totalMinutes,
    walkMinutes: steps.filter((s) => s.type === 'walk').reduce((n, s) => n + s.minutes, 0),
    transfers,
    lines: lines.map((line) => ({
      code: line.code,
      name: line.name,
      origin: line.origin,
      destination: line.destination,
      color: lineColor(line.code),
      operator: line.operator || 'URBS',
      itinerary: line.itinerary || [],
    })),
    steps,
    bounds,
  };
}

function scoreLine(line, origin, destination, stops) {
  const onLine = matchItineraryStops(line, stops);
  const mid = onLine.length ? onLine[Math.floor(onLine.length / 2)] : null;
  const text = normalizeText(`${line.origin} ${line.destination} ${line.name} ${(line.itinerary || []).join(' ')}`);
  const fromKey = normalizeText(origin.label);
  const toKey = normalizeText(destination.label);
  let score = Math.random() * 3;
  if (text.includes(fromKey.split(' ').pop() || '')) score -= 4;
  if (text.includes(toKey.split(' ').pop() || '')) score -= 4;
  if (line.itinerary?.length > 2) score -= 1;
  if (mid) {
    score += haversineKm(origin, mid) + haversineKm(destination, mid);
  }
  return score;
}

function pickLines(lines, origin, destination, stops, count, offset = 0) {
  const ranked = [...lines].sort((a, b) => scoreLine(a, origin, destination, stops) - scoreLine(b, origin, destination, stops));
  const primary = ranked[offset * 2] || ranked[0];
  const secondary = ranked[offset * 2 + 1] || ranked[1];
  if (count === 1) return [primary].filter(Boolean);
  if (count === 2 && secondary) return [primary, secondary].filter(Boolean);
  return [primary].filter(Boolean);
}

function planRoute({ from, to, originLatLng, lines, stops, sourceMeta }) {
  const origin = resolvePlace(from, stops, originLatLng);
  let destination = resolvePlace(to, stops, null);
  if (!origin || !destination) {
    throw new Error('Não foi possível interpretar origem ou destino.');
  }
  destination = ensureDistinctEndpoints(origin, destination);

  const catalog = lines.length ? lines : [];
  if (!catalog.length) {
    throw new Error('Catálogo de linhas indisponível no momento.');
  }
  const labels = ['Recomendada', 'Com menos baldeação', 'Alternativo'];
  const options = [0, 1, 2].map((index) => {
    let lineSet = index === 2
      ? pickLines(catalog, origin, destination, stops, 2, index)
      : pickLines(catalog, origin, destination, stops, 1, index);
    if (!lineSet.length) lineSet = [catalog[index % catalog.length]];
    return buildOption(
      `opt-${index}`,
      labels[index],
      origin,
      destination,
      lineSet,
      stops,
      3 + index * 2,
      Math.max(0, lineSet.length - 1),
    );
  });

  return {
    origin: { label: origin.label, lat: origin.lat, lon: origin.lon, source: origin.source },
    destination: { label: destination.label, lat: destination.lat, lon: destination.lon, source: destination.source },
    source: sourceMeta?.source || 'local',
    warning: sourceMeta?.warning,
    updatedAt: new Date().toISOString(),
    options,
  };
}

module.exports = {
  planRoute,
  lineColor,
  LINE_COLORS,
};
