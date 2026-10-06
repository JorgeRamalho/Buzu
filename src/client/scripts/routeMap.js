(function initBuzzuRouteMap(global) {
  const VIEW = { width: 800, height: 260, padding: 28 };

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
    return { north: north + padding, south: south - padding, east: east + padding, west: west - padding };
  }

  function computeMapBounds(plan, option) {
    const points = [
      { lat: plan.origin.lat, lon: plan.origin.lon },
      { lat: plan.destination.lat, lon: plan.destination.lon },
      ...option.steps.flatMap((step) => step.path || []),
    ];
    return normalizeMapBounds(points);
  }

  function project(lat, lon, bounds) {
    const innerW = VIEW.width - VIEW.padding * 2;
    const innerH = VIEW.height - VIEW.padding * 2;
    const lonSpan = Math.max(bounds.east - bounds.west, 0.0001);
    const latSpan = Math.max(bounds.north - bounds.south, 0.0001);
    const x = VIEW.padding + ((lon - bounds.west) / lonSpan) * innerW;
    const y = VIEW.padding + ((bounds.north - lat) / latSpan) * innerH;
    return { x, y };
  }

  function pathToD(path, bounds) {
    if (!path?.length) return '';
    const deduped = path.filter((point, index) => {
      if (index === 0) return true;
      const prev = path[index - 1];
      return Math.abs(point.lat - prev.lat) > 0.00001 || Math.abs(point.lon - prev.lon) > 0.00001;
    });
    if (deduped.length < 2 && path.length >= 1) {
      const base = deduped[0] || path[0];
      deduped.push({ lat: base.lat - 0.002, lon: base.lon + 0.0025 });
    }
    return deduped
      .map((point, index) => {
        const { x, y } = project(point.lat, point.lon, bounds);
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }

  function markerPositions(plan, bounds) {
    let origin = project(plan.origin.lat, plan.origin.lon, bounds);
    let destination = project(plan.destination.lat, plan.destination.lon, bounds);
    const dx = destination.x - origin.x;
    const dy = destination.y - origin.y;
    if (Math.hypot(dx, dy) < 22) {
      destination = { x: origin.x + 28, y: origin.y - 22 };
    }
    return { origin, destination };
  }

  function escapeAttr(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function escapeHtml(text) {
    return escapeAttr(text).replace(/>/g, '&gt;');
  }

  function renderStepsList(steps) {
    return steps.map((step) => {
      if (step.type === 'walk') {
        return `<li class="route-step route-step-walk"><span class="route-step-icon" aria-hidden="true">🚶</span><span><strong>${step.minutes} min</strong> · ${escapeHtml(step.label)}</span></li>`;
      }
      const stops = step.stops?.length
        ? `<small>${escapeHtml(step.stops.slice(0, 4).join(' → '))}${step.stops.length > 4 ? '…' : ''}</small>`
        : '';
      return `<li class="route-step route-step-transit"><span class="route-step-badge" style="background:${step.color}">${escapeHtml(step.lineCode)}</span><span><strong>${step.minutes} min</strong> · ${escapeHtml(step.label)}${stops ? `<br>${stops}` : ''}</span></li>`;
    }).join('');
  }

  function renderMapSvg(plan, option) {
    const bounds = computeMapBounds(plan, option);
    const segments = option.steps.map((step, index) => {
      const d = pathToD(step.path, bounds);
      if (!d) return '';
      if (step.type === 'walk') {
        return `<path class="route-map-path route-map-path-walk" d="${d}" data-segment="${index}"/>`;
      }
      return `<path class="route-map-path route-map-path-transit" d="${d}" stroke="${step.color}" data-segment="${index}" data-line="${escapeAttr(step.lineCode)}"/>`;
    }).join('');

    const { origin, destination } = markerPositions(plan, bounds);

    const stopDots = option.steps
      .filter((step) => step.type === 'transit')
      .flatMap((step) => (step.path.length > 2 ? step.path.slice(1, -1) : step.path))
      .map((point) => {
        const { x, y } = project(point.lat, point.lon, bounds);
        return `<circle class="route-map-stop-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"/>`;
      })
      .join('');

    return `
      <svg class="route-map-svg" viewBox="0 0 ${VIEW.width} ${VIEW.height}" role="img" aria-label="Mapa da rota selecionada">
        <rect width="100%" height="100%" fill="#eef1ea"/>
        <g class="route-map-grid" opacity="0.35">
          ${Array.from({ length: 9 }, (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="${VIEW.height}" stroke="#c5c9c0" stroke-width="0.6"/>`).join('')}
          ${Array.from({ length: 5 }, (_, i) => `<line x1="0" y1="${i * 90}" x2="${VIEW.width}" y2="${i * 90}" stroke="#c5c9c0" stroke-width="0.6"/>`).join('')}
        </g>
        ${segments}
        ${stopDots}
        <g class="route-map-marker route-map-marker-a">
          <circle cx="${origin.x.toFixed(1)}" cy="${origin.y.toFixed(1)}" r="11" fill="#1a73e8"/>
          <text x="${origin.x.toFixed(1)}" y="${(origin.y + 4).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">A</text>
        </g>
        <g class="route-map-marker route-map-marker-b">
          <circle cx="${destination.x.toFixed(1)}" cy="${destination.y.toFixed(1)}" r="11" fill="#d93025"/>
          <text x="${destination.x.toFixed(1)}" y="${(destination.y + 4).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">B</text>
        </g>
      </svg>`;
  }

  function renderLegend(option) {
    const items = option.steps
      .filter((step) => step.type === 'transit')
      .map((step) => `<span class="route-map-legend-item"><i style="background:${step.color}"></i> Linha ${step.lineCode}</span>`)
      .join('');
    return `<div class="route-map-legend"><span class="route-map-legend-item route-map-legend-walk"><i></i> A pé</span>${items}</div>`;
  }

  function bindOptionSelection(container, plan, onSelect) {
    container.querySelectorAll('[data-route-option-id]').forEach((item) => {
      item.addEventListener('click', () => {
        const optionId = item.dataset.routeOptionId;
        container.querySelectorAll('[data-route-option-id]').forEach((el) => el.classList.toggle('is-active', el.dataset.routeOptionId === optionId));
        const option = plan.options.find((opt) => opt.id === optionId);
        if (option) onSelect(option);
      });
    });
  }

  function updateMapStage(container, plan, option) {
    const stage = container.querySelector('[data-route-map-stage]');
    const stepsList = container.querySelector('[data-route-steps-list]');
    const summary = container.querySelector('[data-route-map-summary]');
    if (stage) stage.innerHTML = renderMapSvg(plan, option);
    if (stepsList) stepsList.innerHTML = renderStepsList(option.steps);
    if (summary) {
      summary.textContent = `${option.timeMinutes} min · ${option.lines.map((l) => `Linha ${l.code}`).join(' → ')} · ${option.transfers} baldeação(ões)`;
    }
    const legend = container.querySelector('[data-route-map-legend]');
    if (legend) legend.innerHTML = renderLegend(option);
  }

  global.renderBuzzuRouteResults = function renderBuzzuRouteResults(plan, resultsPanel, departures) {
    if (!resultsPanel || !plan?.options?.length) return;

    const sourceLabel = plan.source === 'urbs' ? 'URBS' : 'Buzzu';
    const safeFrom = escapeHtml(plan.origin.label);
    const safeTo = escapeHtml(plan.destination.label);

    const renderLine = (line) => `<span class="route-chip route-chip-line" style="border-color:${line.color}" title="${line.name}">${line.code}</span>`;

    resultsPanel.innerHTML = `
      <header class="route-results-header">
        <div class="route-results-title">
          <strong title="${safeFrom}">${safeFrom}</strong>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <strong title="${safeTo}">${safeTo}</strong>
        </div>
        <span>${plan.options[0].timeMinutes} min · via transporte público · ${sourceLabel}</span>
      </header>
      <div class="route-results-layout">
        <ol class="route-results-list">
          ${plan.options.map((opt, idx) => `
            <li class="route-results-item ${idx === 0 ? 'is-recommended is-active' : ''}" data-route-option-id="${opt.id}" role="button" tabindex="0">
              <div class="route-results-tag">${idx === 0 ? 'Recomendada' : opt.label}</div>
              <div class="route-results-time"><strong>${opt.timeMinutes}</strong><span>min</span></div>
              <div class="route-results-body">
                <div class="route-results-lines">${opt.lines.map(renderLine).join('<span class="route-arrow">›</span>')}</div>
                <p class="route-results-line-name" title="${opt.lines.map((l) => l.name).join(' · ')}">${opt.lines.map((line) => `Linha ${escapeHtml(line.code)}`).join(' · ')}</p>
                <ul class="route-results-meta">
                  <li>🚶 ${opt.walkMinutes} min</li>
                  <li>🔁 ${opt.transfers} baldeação(ões)</li>
                  <li>🚏 ${departures[idx] || 'Agora'}</li>
                </ul>
              </div>
            </li>
          `).join('')}
        </ol>
        <div class="route-results-detail">
          <section class="route-map-panel is-visible" aria-label="Mapa detalhado da rota">
            <header class="route-map-panel-head">
              <div>
                <strong>Trajeto no mapa</strong>
                <p data-route-map-summary></p>
              </div>
            </header>
            <div class="route-map-stage" data-route-map-stage></div>
            <div data-route-map-legend></div>
          </section>
          <ol class="route-steps-list" data-route-steps-list></ol>
        </div>
      </div>
      <footer class="route-results-footer">
        <span>Veículos, numeração, itinerários e traçado · fonte ${sourceLabel}${plan.warning ? ' · fallback local' : ''}</span>
      </footer>
    `;

    const defaultOption = plan.options[0];
    updateMapStage(resultsPanel, plan, defaultOption);
    bindOptionSelection(resultsPanel, plan, (option) => updateMapStage(resultsPanel, plan, option));
  };

  const LINE_COLORS = {
    '303': '#459b70', '203': '#db5a4b', '501': '#2e9e5b', '502': '#db5a4b', '520': '#7b5ea7',
    '372': '#4f82a0', '022': '#c9a34b', '110': '#db5a4b',
  };

  function lineColor(code) {
    return LINE_COLORS[String(code)] || '#4285f4';
  }

  const DISTRICT_COORDS = {
    Centro: [-25.4284, -49.2733],
    Cabral: [-25.4056, -49.2536],
    Juvevê: [-25.4145, -49.2445],
    'Hugo Lange': [-25.418, -49.248],
  };

  function haversineKm(a, b) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
  }

  function ensureDistinctEndpoints(origin, destination, minKm = 0.35) {
    if (haversineKm(origin, destination) >= minKm) return destination;
    return {
      ...destination,
      lat: destination.lat - 0.0035,
      lon: destination.lon + 0.0045,
      label: destination.label,
    };
  }

  function normalizeText(value) {
    return String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  }

  function resolvePlace(label, stops, originLatLng) {
    if (originLatLng?.lat != null && originLatLng?.lon != null && !label) {
      return { lat: originLatLng.lat, lon: originLatLng.lon, label: 'Minha localização' };
    }
    const key = normalizeText(label);
    if (!key) return { lat: -25.4284, lon: -49.2733, label: label || 'Curitiba' };

    for (const [district, coords] of Object.entries(DISTRICT_COORDS)) {
      const districtKey = normalizeText(district);
      if (key === districtKey || key === `bairro ${districtKey}`) {
        return { lat: coords[0], lon: coords[1], label: label || district };
      }
    }

    const stop = stops.find((s) => normalizeText(s.name) === key)
      || stops.find((s) => normalizeText(s.name).includes(key) || key.includes(normalizeText(s.name)));
    if (stop && Number.isFinite(stop.lat) && Number.isFinite(stop.lon)) {
      return { lat: stop.lat, lon: stop.lon, label: stop.name };
    }

    for (const [district, coords] of Object.entries(DISTRICT_COORDS)) {
      if (key.includes(normalizeText(district))) {
        return { lat: coords[0], lon: coords[1], label: label || district };
      }
    }

    return { lat: -25.4284, lon: -49.2733, label: label || 'Curitiba' };
  }

  function interpolatePath(from, to, points = 5) {
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

  function buildOptionSteps(origin, destination, lines, walkMinutes) {
    const steps = [];
    let cursor = { ...origin };
    lines.forEach((line, index) => {
      const board = { lat: (cursor.lat + destination.lat) / 2, lon: (cursor.lon + destination.lon) / 2 };
      const walkMin = index === 0 ? walkMinutes : 4;
      steps.push({
        type: 'walk',
        minutes: walkMin,
        label: index === 0 ? `Caminhar até embarque · Linha ${line.code}` : `Baldeação · Linha ${line.code}`,
        path: interpolatePath(cursor, board, 3),
      });
      const ridePath = interpolatePath(board, destination, 8);
      steps.push({
        type: 'transit',
        minutes: Math.max(8, 20 + index * 4),
        lineCode: line.code,
        lineName: line.name,
        color: lineColor(line.code),
        operator: line.operator || 'URBS',
        label: `Linha ${line.code} · ${line.name}`,
        stops: [line.origin, line.destination].filter(Boolean),
        path: ridePath,
      });
      cursor = destination;
    });
    steps.push({
      type: 'walk',
      minutes: 3,
      label: `Caminhar até ${destination.label}`,
      path: interpolatePath(cursor, destination, 3),
    });
    return steps;
  }

  global.buildBuzzuFallbackPlan = function buildBuzzuFallbackPlan({ from, to, fromLabel, originLatLng, lines, stops, meta }) {
    const catalog = lines?.length ? lines : [];
    if (!catalog.length) return null;
    const origin = resolvePlace(from || fromLabel, stops, originLatLng);
    let destination = resolvePlace(to, stops, null);
    destination = ensureDistinctEndpoints(origin, destination);
    const shuffled = [...catalog].sort(() => Math.random() - 0.5);
    const labels = ['Recomendada', 'Com menos baldeação', 'Alternativo'];

    const options = [0, 1, 2].map((index) => {
      const primary = shuffled[index * 2] || shuffled[0];
      const secondary = shuffled[index * 2 + 1];
      const lineSet = index === 2 && secondary ? [primary, secondary] : [primary];
      const steps = buildOptionSteps(origin, destination, lineSet, 3 + index * 2);
      const allPoints = [
        { lat: origin.lat, lon: origin.lon },
        { lat: destination.lat, lon: destination.lon },
        ...steps.flatMap((s) => s.path),
      ];
      const timeMinutes = steps.reduce((sum, step) => sum + step.minutes, 0);
      return {
        id: `opt-${index}`,
        label: labels[index],
        timeMinutes,
        walkMinutes: steps.filter((s) => s.type === 'walk').reduce((n, s) => n + s.minutes, 0),
        transfers: Math.max(0, lineSet.length - 1),
        lines: lineSet.map((line) => ({
          code: line.code,
          name: line.name,
          origin: line.origin,
          destination: line.destination,
          color: lineColor(line.code),
          operator: line.operator || 'URBS',
          itinerary: line.itinerary || [],
        })),
        steps,
        bounds: normalizeMapBounds(allPoints, 0.012),
      };
    });

    return {
      origin: { label: origin.label, lat: origin.lat, lon: origin.lon },
      destination: { label: destination.label, lat: destination.lat, lon: destination.lon },
      source: meta?.source || 'local',
      warning: 'Cálculo local no navegador (API de rotas indisponível).',
      updatedAt: new Date().toISOString(),
      options,
    };
  };
})(window);
