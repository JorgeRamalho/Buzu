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
    return `<div class="route-map-legend"><span class="route-map-legend-item route-map-legend-primary"><i></i> Trajeto</span><span class="route-map-legend-item route-map-legend-walk"><i></i> A pé</span>${items}</div>`;
  }

  const MAP_STYLE = {
    routeBlue: '#4285F4',
    routeBlueDark: '#1967D2',
    origin: '#4285F4',
    destination: '#EA4335',
    tileUrl: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  };

  function collectRouteLatLngs(plan, option) {
    const points = [
      [plan.origin.lat, plan.origin.lon],
      [plan.destination.lat, plan.destination.lon],
    ];
    option.steps.forEach((step) => {
      (step.path || []).forEach((p) => points.push([p.lat, p.lon]));
    });
    return points;
  }

  function ensureMapShell(stage) {
    if (stage.querySelector('[data-route-leaflet]')) return stage;
    stage.innerHTML = `
      <div class="route-map-od-bar" aria-label="Origem e destino">
        <button type="button" class="route-map-od-row" data-route-focus-origin title="Origem">
          <span class="route-map-od-dot origin" aria-hidden="true"></span>
          <span class="route-map-od-text">
            <small>Origem</small>
            <strong data-route-origin-label></strong>
          </span>
        </button>
        <button type="button" class="route-map-od-row" data-route-focus-dest title="Destino">
          <span class="route-map-od-dot dest" aria-hidden="true"></span>
          <span class="route-map-od-text">
            <small>Destino</small>
            <strong data-route-dest-label></strong>
          </span>
        </button>
      </div>
      <div class="route-map-leaflet-host" data-route-leaflet role="application" aria-label="Mapa interativo da rota"></div>`;
    return stage;
  }

  function createMarkerIcon(label, variant) {
    const cls = variant === 'dest' ? 'route-map-pin route-map-pin-dest' : 'route-map-pin route-map-pin-origin';
    return global.L.divIcon({
      className: 'route-map-pin-wrap',
      html: `<span class="${cls}"><span class="route-map-pin-label">${label}</span></span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }

  function drawRouteOnMap(map, plan, option) {
    const routeGroup = global.L.layerGroup().addTo(map);
    const streetPath = option._directionsPath?.length > 1 ? option._directionsPath : null;

    if (streetPath) {
      const latlngs = streetPath.map((point) => [point.lat, point.lon]);
      global.L.polyline(latlngs, {
        color: '#ffffff',
        weight: 10,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(routeGroup);
      global.L.polyline(latlngs, {
        color: MAP_STYLE.routeBlue,
        weight: 6,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(routeGroup);
    }

    if (!streetPath) option.steps.forEach((step) => {
      const latlngs = (step.path || [])
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
        .map((p) => [p.lat, p.lon]);
      if (latlngs.length < 2) return;

      if (step.type === 'walk') {
        global.L.polyline(latlngs, {
          color: MAP_STYLE.routeBlue,
          weight: 5,
          opacity: 0.9,
          dashArray: '8 8',
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routeGroup);
        return;
      }

      global.L.polyline(latlngs, {
        color: '#ffffff',
        weight: 10,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(routeGroup);
      global.L.polyline(latlngs, {
        color: MAP_STYLE.routeBlue,
        weight: 6,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(routeGroup);
    });

    global.L.marker([plan.origin.lat, plan.origin.lon], {
      icon: createMarkerIcon('A', 'origin'),
      title: plan.origin.label,
      zIndexOffset: 500,
    }).addTo(routeGroup);

    global.L.marker([plan.destination.lat, plan.destination.lon], {
      icon: createMarkerIcon('B', 'dest'),
      title: plan.destination.label,
      zIndexOffset: 600,
    }).addTo(routeGroup);

    return routeGroup;
  }

  function mountRouteLeafletMap(stage, plan, option) {
    if (!stage) return false;

    if (!global.L) {
      stage.innerHTML = renderMapSvg(plan, option);
      return false;
    }

    ensureMapShell(stage);
    const host = stage.querySelector('[data-route-leaflet]');
    if (!host) return false;
    if (host._buzzuGoogleMap && !global.__BUZZU_GOOGLE_MAPS_FAILED__) return true;

    let map = host._buzzuLeafletMap;
    if (!map) {
      map = global.L.map(host, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
      });
      global.L.tileLayer(MAP_STYLE.tileUrl, {
        attribution: MAP_STYLE.tileAttribution,
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map);
      host._buzzuLeafletMap = map;
    }

    if (host._buzzuRouteLayer) {
      map.removeLayer(host._buzzuRouteLayer);
    }
    host._buzzuRouteLayer = drawRouteOnMap(map, plan, option);

    const bounds = collectRouteLatLngs(plan, option);
    if (bounds.length) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
    }

    requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
    });

    return true;
  }

  function updateOdPanel(container, plan) {
    const originEl = container.querySelector('[data-route-origin-label]');
    const destEl = container.querySelector('[data-route-dest-label]');
    if (originEl) originEl.textContent = plan.origin.label;
    if (destEl) destEl.textContent = plan.destination.label;
  }

  let mapsConfigPromise = null;
  let mapDrawToken = 0;

  function loadMapsConfig() {
    if (!mapsConfigPromise) {
      mapsConfigPromise = fetch('/api/maps/config')
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null)
        .then((data) => data || { googleMaps: false, browserKey: null, directions: false });
    }
    return mapsConfigPromise;
  }

  function samplePath(path, max = 6) {
    const clean = (path || []).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
    if (clean.length <= max) return clean;
    const sampled = [];
    for (let index = 0; index < max; index += 1) {
      const pointIndex = Math.round((index * (clean.length - 1)) / (max - 1));
      sampled.push(clean[pointIndex]);
    }
    return sampled;
  }

  async function snapStepWithOsrm(step) {
    const coordinates = samplePath(step.path);
    if (coordinates.length < 2) return step.path || [];
    try {
      const response = await fetch('/api/maps/osrm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: step.type === 'walk' ? 'foot' : 'driving',
          coordinates,
        }),
      });
      if (!response.ok) return step.path || [];
      const data = await response.json();
      if (Array.isArray(data.path) && data.path.length > 1) return data.path;
    } catch {
      // O traçado reto continua visível se o OSRM não responder.
    }
    return step.path || [];
  }

  async function snapOptionWithOsrm(option) {
    if (option._osrmSnapped) return option;
    const steps = await Promise.all(option.steps.map(async (step) => ({
      ...step,
      path: await snapStepWithOsrm(step),
    })));
    option.steps = steps;
    option._osrmSnapped = true;
    return option;
  }

  function loadGoogleMapsScript(key) {
    if (global.google?.maps) return Promise.resolve(global.google.maps);
    if (global.__BUZZU_GOOGLE_MAPS_FAILED__) return Promise.reject(new Error('google-auth'));
    if (!global.__BUZZU_GOOGLE_MAPS_PROMISE__) {
      global.__BUZZU_GOOGLE_MAPS_PROMISE__ = new Promise((resolve, reject) => {
        global.gm_authFailure = () => {
          global.__BUZZU_GOOGLE_MAPS_FAILED__ = true;
          reject(new Error('google-auth'));
        };
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=pt-BR&region=BR`;
        script.async = true;
        script.onload = () => {
          if (global.google?.maps) resolve(global.google.maps);
          else reject(new Error('google-missing'));
        };
        script.onerror = () => reject(new Error('google-script'));
        document.head.appendChild(script);
      }).catch((error) => {
        global.__BUZZU_GOOGLE_MAPS_PROMISE__ = null;
        throw error;
      });
    }
    return global.__BUZZU_GOOGLE_MAPS_PROMISE__;
  }

  function setMapProviderLabel(container, text) {
    const label = container.querySelector('[data-route-map-provider]');
    if (label) label.textContent = text;
  }

  function routePoints(plan, option) {
    if (option._directionsPath?.length > 1) return option._directionsPath;
    return collectRouteLatLngs(plan, option).map(([lat, lon]) => ({ lat, lon }));
  }

  function drawGoogleRoute(map, maps, plan, option) {
    const overlays = [];
    const addLine = (path, dashed) => {
      if (path.length < 2) return;
      overlays.push(new maps.Polyline({
        path: path.map((point) => ({ lat: point.lat, lng: point.lon })),
        strokeColor: MAP_STYLE.routeBlue,
        strokeOpacity: dashed ? 0 : 1,
        strokeWeight: dashed ? 4 : 6,
        icons: dashed ? [{
          icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
          offset: '0',
          repeat: '14px',
        }] : undefined,
        map,
      }));
    };

    if (option._directionsPath?.length > 1) {
      addLine(option._directionsPath, false);
    } else {
      option.steps.forEach((step) => addLine(step.path || [], step.type === 'walk'));
    }

    const markerIcon = (color) => ({
      path: maps.SymbolPath.CIRCLE,
      scale: 14,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
    });

    overlays.push(new maps.Marker({
      position: { lat: plan.origin.lat, lng: plan.origin.lon },
      map,
      title: plan.origin.label,
      label: { text: 'A', color: '#ffffff', fontWeight: '700' },
      icon: markerIcon(MAP_STYLE.origin),
    }));
    overlays.push(new maps.Marker({
      position: { lat: plan.destination.lat, lng: plan.destination.lon },
      map,
      title: plan.destination.label,
      label: { text: 'B', color: '#ffffff', fontWeight: '700' },
      icon: markerIcon(MAP_STYLE.destination),
    }));
    return overlays;
  }

  async function mountGoogleMap(host, plan, option, key) {
    const maps = await loadGoogleMapsScript(key);
    if (host._buzzuLeafletMap) {
      host._buzzuLeafletMap.remove();
      host._buzzuLeafletMap = null;
      host.replaceChildren();
    }

    let map = host._buzzuGoogleMap;
    if (!map) {
      map = new maps.Map(host, {
        center: { lat: plan.origin.lat, lng: plan.origin.lon },
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
      });
      host._buzzuGoogleMap = map;
    }

    (host._buzzuGoogleOverlays || []).forEach((overlay) => overlay.setMap(null));
    host._buzzuGoogleOverlays = drawGoogleRoute(map, maps, plan, option);

    const bounds = new maps.LatLngBounds();
    routePoints(plan, option).forEach((point) => {
      if (Number.isFinite(point.lat) && Number.isFinite(point.lon)) {
        bounds.extend({ lat: point.lat, lng: point.lon });
      }
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds, 36);
    return true;
  }

  function renderActiveMap(stage, plan, option, config) {
    ensureMapShell(stage);
    const host = stage.querySelector('[data-route-leaflet]');
    const useGoogle = Boolean(config?.googleMaps && config.browserKey && !global.__BUZZU_GOOGLE_MAPS_FAILED__);
    if (useGoogle) {
      return mountGoogleMap(host, plan, option, config.browserKey).catch(() => {
        global.__BUZZU_GOOGLE_MAPS_FAILED__ = true;
        if (host._buzzuGoogleMap) {
          host._buzzuGoogleMap = null;
          host.replaceChildren();
        }
        mountRouteLeafletMap(stage, plan, option);
      });
    }
    mountRouteLeafletMap(stage, plan, option);
    return Promise.resolve();
  }

  async function fetchDirectionsPath(plan) {
    if (plan._directionsResult) return plan._directionsResult;
    const origin = `${plan.origin.lat},${plan.origin.lon}`;
    const destination = `${plan.destination.lat},${plan.destination.lon}`;
    try {
      const response = await fetch(`/api/maps/directions?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`);
      const data = response.ok ? await response.json() : null;
      plan._directionsResult = data;
      return data;
    } catch {
      plan._directionsResult = null;
      return null;
    }
  }

  function bindOdPanelFocus(container) {
    container.querySelector('[data-route-focus-origin]')?.addEventListener('click', () => {
      document.getElementById('from')?.focus();
    });
    container.querySelector('[data-route-focus-dest]')?.addEventListener('click', () => {
      document.getElementById('to')?.focus();
    });
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
    const token = (mapDrawToken += 1);
    const stage = container.querySelector('[data-route-map-stage]');
    const stepsList = container.querySelector('[data-route-steps-list]');
    const summary = container.querySelector('[data-route-map-summary]');
    if (stage) renderActiveMap(stage, plan, option, null);
    setMapProviderLabel(container, 'Ajustando ruas…');
    updateOdPanel(container, plan);

    loadMapsConfig().then(async (config) => {
      if (token !== mapDrawToken) return;
      let directions = null;
      if (config.directions) directions = await fetchDirectionsPath(plan);
      if (token !== mapDrawToken) return;

      if (directions?.status === 'OK' && directions.path?.length > 1) {
        option._directionsPath = directions.path;
        setMapProviderLabel(container, 'Google Maps · Directions');
      } else {
        await snapOptionWithOsrm(option);
        if (token !== mapDrawToken) return;
        setMapProviderLabel(container, config.googleMaps ? 'Google Maps · OSRM' : 'Ruas · OSRM');
      }

      if (stage) await renderActiveMap(stage, plan, option, config);
    }).catch(() => {
      if (token !== mapDrawToken) return;
      setMapProviderLabel(container, 'Ruas · OpenStreetMap');
    });
    if (stepsList) stepsList.innerHTML = renderStepsList(option.steps);
    if (summary) {
      summary.textContent = `${option.timeMinutes} min · ${option.lines.map((l) => `Linha ${l.code}`).join(' → ')} · ${option.transfers} baldeação(ões)`;
    }
    const legend = container.querySelector('[data-route-map-legend]');
    if (legend) legend.innerHTML = renderLegend(option);
  }

  async function fetchStreetPath(origin, destination) {
    const coordinates = [
      { lat: origin.lat, lon: origin.lon },
      { lat: destination.lat, lon: destination.lon },
    ];
    try {
      const response = await fetch('/api/maps/osrm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: 'driving', coordinates }),
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.path) && data.path.length > 1) return data.path;
      }
    } catch {
      // tenta o OSRM direto
    }

    try {
      const endpoint = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson`;
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        const geometry = data?.routes?.[0]?.geometry?.coordinates;
        if (Array.isArray(geometry) && geometry.length > 1) {
          return geometry.map(([lon, lat]) => ({ lat, lon }));
        }
      }
    } catch {
      // mantém a reta entre os dois pontos
    }

    return coordinates;
  }

  function drawStreetRoute(map, plan, path) {
    if (map._buzzuStreetLayer) map.removeLayer(map._buzzuStreetLayer);
    const layer = global.L.layerGroup().addTo(map);
    const latlngs = path.map((point) => [point.lat, point.lon]);
    global.L.polyline(latlngs, {
      color: '#ffffff',
      weight: 10,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(layer);
    global.L.polyline(latlngs, {
      color: '#4285F4',
      weight: 6,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(layer);
    global.L.marker([plan.origin.lat, plan.origin.lon], {
      icon: createMarkerIcon('A', 'origin'),
      title: plan.origin.label,
    }).addTo(layer);
    global.L.marker([plan.destination.lat, plan.destination.lon], {
      icon: createMarkerIcon('B', 'dest'),
      title: plan.destination.label,
    }).addTo(layer);
    map._buzzuStreetLayer = layer;
    map.fitBounds(latlngs, { padding: [36, 36], maxZoom: 16 });
  }

  function bindStreetModalClose() {
    const modal = document.getElementById('route-street-modal');
    if (!modal || modal.dataset.bound === 'true') return;
    modal.dataset.bound = 'true';
    modal.querySelector('[data-route-street-close]')?.addEventListener('click', () => {
      modal.hidden = true;
    });
  }

  global.openBuzzuStreetMap = async function openBuzzuStreetMap(plan) {
    const modal = document.getElementById('route-street-modal');
    const canvas = modal?.querySelector('[data-route-street-map]');
    const summary = modal?.querySelector('[data-route-street-summary]');
    if (!modal || !canvas || !plan?.origin || !plan?.destination) return;

    bindStreetModalClose();
    modal.hidden = false;
    const fromLabel = modal.querySelector('[data-route-street-from]');
    const toLabel = modal.querySelector('[data-route-street-to]');
    if (fromLabel) fromLabel.textContent = plan.origin.label;
    if (toLabel) toLabel.textContent = plan.destination.label;
    if (summary) summary.textContent = 'Traçando o caminho pelas ruas…';

    if (!global.L) {
      if (summary) summary.textContent = 'Não foi possível abrir o mapa. Recarregue a página.';
      return;
    }

    if (!canvas._buzzuStreetMap) {
      const map = global.L.map(canvas, { zoomControl: true, scrollWheelZoom: true });
      global.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map);
      canvas._buzzuStreetMap = map;
    }

    const map = canvas._buzzuStreetMap;
    requestAnimationFrame(() => map.invalidateSize());
    const path = await fetchStreetPath(plan.origin, plan.destination);
    drawStreetRoute(map, plan, path);
    requestAnimationFrame(() => map.invalidateSize());
    if (summary) {
      summary.textContent = path.length > 2
        ? 'Origem e destino ligados pelas ruas e avenidas'
        : 'Trajeto direto entre os dois pontos';
    }
  };

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
          <section class="route-steps-panel" aria-label="Etapas da viagem">
            <header class="route-steps-panel-head"><strong>Detalhes do percurso</strong></header>
            <ol class="route-steps-list" data-route-steps-list></ol>
          </section>
        </div>
      </div>
      <footer class="route-results-footer">
        <span>Veículos, numeração, itinerários e traçado · fonte ${sourceLabel}${plan.warning ? ' · fallback local' : ''}</span>
      </footer>
    `;

    const defaultOption = plan.options[0];
    const stepsList = resultsPanel.querySelector('[data-route-steps-list]');
    if (stepsList) stepsList.innerHTML = renderStepsList(defaultOption.steps);
    bindOptionSelection(resultsPanel, plan, (option) => {
      const list = resultsPanel.querySelector('[data-route-steps-list]');
      if (list) list.innerHTML = renderStepsList(option.steps);
    });
    global.openBuzzuStreetMap(plan);
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
