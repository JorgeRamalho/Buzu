const searchDrawer = document.querySelector('[data-search-drawer]');
const searchToggle = document.querySelector('[data-search-toggle]');
const searchClose = document.querySelector('[data-search-close]');
const globalSearch = document.querySelector('#global-search');
const routeInputs = document.querySelectorAll('.route-field input');

function resolveApiBases() {
  const bases = new Set();
  if (window.__BUZZU_API__) bases.add(String(window.__BUZZU_API__).replace(/\/$/, ''));
  bases.add('/api');
  const { protocol, hostname, port } = window.location;
  if (port && port !== '3000') {
    bases.add(`${protocol}//${hostname}:3000/api`);
    bases.add('http://127.0.0.1:3000/api');
  }
  return [...bases];
}

const API = resolveApiBases()[0];

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error('Resposta vazia do servidor. Inicie com npm start e abra http://localhost:3000');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Resposta inválida do servidor. Use http://localhost:3000 (npm start).');
  }
}

async function requestRoutePlan(payload) {
  const bases = resolveApiBases();
  let lastError = null;
  for (const base of bases) {
    try {
      const response = await fetch(`${base}/routes/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível calcular a rota.');
      }
      if (!Array.isArray(data.options) || !data.options.length) {
        throw new Error('O servidor não retornou opções de rota.');
      }
      return data;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Não foi possível contactar a API de rotas.');
}
let transitLinesCatalog = [];
let transitLinesMeta = { source: 'local' };

const neighborhoodNames = [
  'Abranches', 'Água Verde', 'Ahú', 'Alto Boqueirão', 'Alto da Glória', 'Alto da XV',
  'Atuba', 'Augusta', 'Bacacheri', 'Bairro Alto', 'Barreirinha', 'Batel', 'Bigorrilho',
  'Boa Vista', 'Bom Retiro', 'Boqueirão', 'Cabral', 'Cachoeira', 'Cajuru', 'Campina do Siqueira',
  'Campo Comprido', 'Campo de Santana', 'Capão da Imbuia', 'Capão Raso', 'Cascatinha', 'Caximba',
  'Centro', 'Centro Cívico', 'Cidade Industrial', 'Cristo Rei', 'Fanny', 'Fazendinha', 'Ganchinho',
  'Guabirotuba', 'Guaíra', 'Hauer', 'Hugo Lange', 'Jardim Botânico', 'Jardim das Américas',
  'Jardim Social', 'Juvevê', 'Lamenha Pequena', 'Lindóia', 'Mercês', 'Mossunguê', 'Novo Mundo',
  'Orleans', 'Parolin', 'Pilarzinho', 'Pinheirinho', 'Portão', 'Prado Velho', 'Rebouças',
  'Riviera', 'Santa Cândida', 'Santa Felicidade', 'Santa Quitéria', 'Santo Inácio', 'São Braz',
  'São Francisco', 'São João', 'São Lourenço', 'Seminário', 'Sítio Cercado', 'Taboão', 'Tarumã',
  'Tatuquara', 'Tingui', 'Uberaba', 'Umbará', 'Vila Izabel', 'Vista Alegre', 'Xaxim'
];

const neighborhoodCoordinates = {
  Centro: [-25.4284, -49.2733],
  Batel: [-25.4417, -49.2892],
  'Água Verde': [-25.4557, -49.2864],
  Rebouças: [-25.4477, -49.2656],
  'Jardim Botânico': [-25.4422, -49.2404],
  Cabral: [-25.4056, -49.2536],
  'Santa Felicidade': [-25.3991, -49.3334],
  Portão: [-25.4772, -49.2933]
};

const neighborhoodData = neighborhoodNames.map(name => {
  const [latitude, longitude] = neighborhoodCoordinates[name] || [-25.4284, -49.2733];
  return { name, latitude, longitude };
});

function chooseNeighborhoods() {
  return [...neighborhoodData].sort(() => Math.random() - 0.5);
}

function updateCuritibaClock() {
  const clock = document.querySelector('[data-curitiba-time]');
  if (clock) clock.textContent = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit'
  }).format(new Date());
}

async function loadCuritibaWeather() {
  const weatherElement = document.querySelector('[data-weather]');
  if (!weatherElement) return;
  const weatherLabels = {
    0: 'Céu limpo', 1: 'Pouco nublado', 2: 'Parcialmente nublado', 3: 'Nublado',
    45: 'Neblina', 48: 'Neblina', 51: 'Garoa leve', 53: 'Garoa', 55: 'Garoa forte',
    61: 'Chuva leve', 63: 'Chuva', 65: 'Chuva forte', 80: 'Pancadas de chuva',
    81: 'Pancadas de chuva', 82: 'Pancadas fortes', 95: 'Trovoada'
  };
  try {
    const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-25.4284&longitude=-49.2733&current=temperature_2m,wind_speed_10m,weather_code&timezone=America%2FSao_Paulo');
    if (!response.ok) throw new Error('Clima indisponível');
    const data = await response.json();
    const current = data.current;
    const temperature = Math.round(current.temperature_2m);
    const wind = Math.round(current.wind_speed_10m);
    weatherElement.textContent = `${temperature}° · ${weatherLabels[current.weather_code] || 'Condição variável'} · vento ${wind} km/h`;
  } catch (error) {
    weatherElement.textContent = '18° · Curitiba · clima em atualização';
  }
}

async function loadNeighborhoodBoard() {
  const panel = document.querySelector('[data-neighborhood-panel]');
  const nameElement = document.querySelector('[data-neighborhood-name]');
  const statusElement = document.querySelector('[data-neighborhood-status]');
  if (!panel || !nameElement || !statusElement) return;

  const selected = chooseNeighborhoods();
  let currentWeather = { temperature: 18, wind: 8, rain: '0.0' };
  try {
    const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-25.4284&longitude=-49.2733&current=temperature_2m,wind_speed_10m,precipitation&timezone=America%2FSao_Paulo');
    if (!response.ok) throw new Error('Clima indisponível');
    const current = (await response.json()).current;
    currentWeather = { temperature: Math.round(current.temperature_2m), wind: Math.round(current.wind_speed_10m), rain: Number(current.precipitation || 0).toFixed(1) };
  } catch (error) {
    // Mantém o painel utilizável quando a fonte climática estiver indisponível.
  }
  const reports = selected.map(neighborhood => ({
    ...neighborhood,
    ...currentWeather,
    traffic: ['Fluxo leve', 'Fluxo moderado', 'Fluxo intenso'][Math.floor(Math.random() * 3)],
    accidents: null,
    movement: 'Movimentação ativa'
  }));

  let index = 0;
  const showReport = () => {
    const report = reports[index];
    panel.classList.remove('is-changing');
    void panel.offsetWidth;
    panel.classList.add('is-changing');
    nameElement.textContent = report.name;
    statusElement.textContent = [
      `${report.temperature}°`,
      `vento ${report.wind} km/h`,
      `chuva ${report.rain} mm`,
      report.traffic,
      report.accidents,
      report.movement
    ].filter(Boolean).join(' · ');
    index = (index + 1) % reports.length;
  };
  showReport();
  setInterval(showReport, 5500);
}

updateCuritibaClock();
setInterval(updateCuritibaClock, 30000);
loadCuritibaWeather();
loadNeighborhoodBoard();

const originInput = document.querySelector('#from');
const destinationInput = document.querySelector('#to');
let originCoordinates = '';

function clearStoredOrigin(event) {
  if (!event.target.dataset.coordinates) return;
  originCoordinates = '';
  delete event.target.dataset.coordinates;
  const locationButton = document.getElementById('use-my-location');
  locationButton?.classList.remove('is-active');
  if (locationButton) locationButton.textContent = 'Usar minha localização';
}

originInput?.addEventListener('input', clearStoredOrigin);

function setRouteNote(message) {
  const note = document.querySelector('.route-note');
  if (note) note.innerHTML = `<span>✦</span> ${escapeHtml(message)}`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function validateRouteSearch({ from, to, hasOriginCoords }) {
  if ((!from && !hasOriginCoords) || !to) {
    return 'Informe origem e destino para calcular sua rota.';
  }
  if (from && to && from.toLocaleLowerCase('pt-BR') === to.toLocaleLowerCase('pt-BR')) {
    return 'Escolha pontos diferentes para calcular sua rota.';
  }
  if ((!from || from.length < 3) && !hasOriginCoords) {
    return 'Digite uma origem mais completa ou use sua localização.';
  }
  if (to.length < 3) {
    return 'Digite um destino mais completo.';
  }
  return null;
}

function lineRouteSummary(line) {
  const route = line.origin && line.destination ? `${line.origin} → ${line.destination}` : line.name;
  const itinerary = Array.isArray(line.itinerary) && line.itinerary.length
    ? line.itinerary.join(' · ')
    : line.terminus || '';
  return { route, itinerary };
}

function shuffleLines(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function buildRouteOptions() {
  if (!transitLinesCatalog.length) {
    return [
      { label: 'Mais rápido', time: 26, lines: [{ code: '303', name: 'Centenário / Campo Comprido', origin: 'Centenário', destination: 'Campo Comprido', itinerary: [] }], walk: '3 min a pé', transfers: 0 },
      { label: 'Com menos baldeação', time: 34, lines: [{ code: '203', name: 'Expresso Santa Cândida', origin: 'Centro', destination: 'Santa Cândida', itinerary: [] }], walk: '6 min a pé', transfers: 0 },
      { label: 'Alternativo', time: 42, lines: [{ code: '022', name: 'Interbairros II', origin: 'Centro', destination: 'Bairros', itinerary: [] }, { code: '372', name: 'Augusto Stresser', origin: 'Centro Cívico', destination: 'Augusto Stresser', itinerary: [] }], walk: '8 min a pé', transfers: 1 }
    ];
  }

  const pool = shuffleLines(transitLinesCatalog);
  return [0, 1, 2].map((index) => {
    const primary = pool[index * 2] || pool[0];
    const secondary = pool[index * 2 + 1];
    const lines = secondary && index === 2 ? [primary, secondary] : [primary];
    return {
      label: index === 0 ? 'Mais rápido' : index === 1 ? 'Com menos baldeação' : 'Alternativo',
      time: 20 + Math.floor(Math.random() * 24),
      lines,
      walk: `${3 + index * 2} min a pé`,
      transfers: Math.max(0, lines.length - 1)
    };
  });
}

async function loadTransitLinesCatalog() {
  for (const base of resolveApiBases()) {
    try {
      const response = await fetch(`${base}/transit/lines`);
      if (!response.ok) continue;
      const payload = await readJsonResponse(response);
      transitLinesCatalog = payload.lines || [];
      transitLinesMeta = payload;
      window.__buzzuExtendTransitLines?.(transitLinesCatalog);
      return;
    } catch {
      // tenta próxima base
    }
  }
  console.warn('Linhas URBS/Buzzu indisponíveis no momento.');
}

loadTransitLinesCatalog();

const GEOLOCATION_OPTIONS = { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 };

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestTransitStop(lat, lon, stopList) {
  let nearest = null;
  let distanceKm = Infinity;
  for (const stop of stopList) {
    if (!Number.isFinite(stop.lat) || !Number.isFinite(stop.lon)) continue;
    const d = haversineKm(lat, lon, stop.lat, stop.lon);
    if (d < distanceKm) {
      distanceKm = d;
      nearest = stop;
    }
  }
  return nearest ? { stop: nearest, distanceKm } : null;
}

function requestPassengerPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error('unsupported'), { code: 'UNSUPPORTED' }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        let label = 'Minha localização atual';
        try {
          const response = await fetch(`${API}/geo/reverse?lat=${coords.latitude}&lon=${coords.longitude}`);
          if (response.ok) {
            const data = await response.json();
            label = data?.label || label;
          }
        } catch {
          /* endereço aproximado opcional */
        }
        resolve({
          lat: coords.latitude,
          lon: coords.longitude,
          label,
          coordinates: `${coords.latitude},${coords.longitude}`,
        });
      },
      (error) => reject(error),
      GEOLOCATION_OPTIONS
    );
  });
}

function usePassengerLocation() {
  const locationButton = document.getElementById('use-my-location');
  setRouteNote('Solicitando permissão de localização...');
  if (locationButton) {
    locationButton.disabled = true;
    locationButton.textContent = 'Localizando...';
  }
  requestPassengerPosition()
    .then((position) => {
      originCoordinates = position.coordinates;
      if (originInput) {
        originInput.value = position.label;
        originInput.dataset.coordinates = position.coordinates;
      }
      if (locationButton) {
        locationButton.classList.add('is-active');
        locationButton.textContent = 'Localização ativa';
      }
      setRouteNote(`Origem definida: ${position.label}`);
    })
    .catch((error) => {
      if (error?.code === 'UNSUPPORTED') {
        setRouteNote('Seu navegador não oferece localização automática. Digite o ponto de partida.');
        return;
      }
      if (locationButton) locationButton.textContent = 'Usar minha localização';
      const reason = error?.code === error.PERMISSION_DENIED
        ? 'Permita o acesso à localização no navegador para usar esta opção.'
        : 'Não foi possível acessar sua localização. Digite o ponto de partida.';
      setRouteNote(reason);
    })
    .finally(() => {
      if (locationButton) locationButton.disabled = false;
    });
}

document.getElementById('use-my-location')?.addEventListener('click', usePassengerLocation);

const statusScroll = document.querySelector('.status-scroll');
if (statusScroll && !statusScroll.dataset.marqueeReady) {
  const statusContent = statusScroll.innerHTML;
  statusScroll.innerHTML = `<div class="status-track"><div class="status-copy">${statusContent}</div><div class="status-copy" aria-hidden="true">${statusContent}</div></div>`;
  statusScroll.dataset.marqueeReady = 'true';
}

const searchCatalog = [
  { icon: '↗', title: 'Rotas e horários', detail: 'Planeje uma viagem por Curitiba', type: 'Explorar', target: '#rotas' },
  { icon: '203', title: 'Expresso Santa Cândida', detail: 'Linha 203 · Rodoferroviária', type: 'Linha', target: '#status' },
  { icon: '303', title: 'Centenário / Campo Comprido', detail: 'Linha 303 · Próximas partidas', type: 'Linha', target: '#status' },
  { icon: '⌖', title: 'Tubo Rodoferroviária', detail: 'Chegadas e partidas em tempo real', type: 'Tubo', target: '#status' },
  { icon: '◒', title: 'Meu cartão transporte', detail: 'Saldo, recarga e pagamentos', type: 'Serviço', target: '#cartao' },
  { icon: '?', title: 'Central de ajuda', detail: 'Dúvidas sobre o Buzzu', type: 'Suporte', target: '#conta' }
];

const searchInner = searchDrawer?.querySelector('.search-inner');
const searchResults = document.createElement('div');
searchResults.className = 'search-results';
searchResults.setAttribute('role', 'listbox');
searchResults.hidden = true;
searchInner?.append(searchResults);

function renderSearchResults(query = '') {
  const normalized = query.trim().toLowerCase();
  const matches = searchCatalog.filter(item => `${item.title} ${item.detail} ${item.type}`.toLowerCase().includes(normalized)).slice(0, 5);
  searchResults.innerHTML = matches.length
    ? matches.map((item, index) => `<button class="search-result" type="button" role="option" data-search-target="${item.target}" data-search-index="${index}"><span class="search-result-icon">${item.icon}</span><span class="search-result-copy"><strong>${item.title}</strong><small>${item.detail}</small></span><span class="search-result-type">${item.type}</span></button>`).join('')
    : '<div class="search-empty">Nenhum resultado encontrado. Tente uma linha, tubo ou serviço.</div>';
  searchResults.querySelectorAll('[data-search-target]').forEach(result => result.addEventListener('click', () => {
    searchDrawer.classList.remove('is-open');
    searchResults.hidden = true;
    document.querySelector(result.dataset.searchTarget)?.scrollIntoView({ behavior: 'smooth' });
  }));
}

globalSearch?.setAttribute('role', 'combobox');
globalSearch?.setAttribute('aria-controls', 'buzu-search-results');
searchResults.id = 'buzu-search-results';
globalSearch?.addEventListener('input', () => { searchResults.hidden = false; renderSearchResults(globalSearch.value); });
globalSearch?.addEventListener('keydown', event => {
  if (event.key === 'Escape') { searchDrawer.classList.remove('is-open'); searchResults.hidden = true; }
});

const heroVisual = document.querySelector('.hero-visual');
if (heroVisual && !heroVisual.querySelector('.city-scene')) {
  const scene = document.createElement('div');
  scene.className = 'city-scene';
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = '<div class="city-skyline"></div><div class="city-road"></div><span class="traffic-vehicle traffic-car"></span><span class="traffic-vehicle traffic-car traffic-car-two"></span><span class="traffic-vehicle traffic-moto"></span><span class="traffic-vehicle traffic-moto traffic-moto-two"></span><span class="traffic-vehicle traffic-van"></span><span class="traffic-vehicle traffic-truck"></span><span class="traffic-vehicle traffic-bus"></span>';
  heroVisual.prepend(scene);
  let framePending = false;
  heroVisual.addEventListener('pointermove', event => {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => {
      const offset = (event.clientX - heroVisual.getBoundingClientRect().left - heroVisual.clientWidth / 2) / 18;
      heroVisual.style.setProperty('--scene-x', `${offset}px`);
      framePending = false;
    });
  });
  heroVisual.addEventListener('pointerleave', () => heroVisual.style.setProperty('--scene-x', '0px'));
}

async function loadTransitStatus() {
  try {
    const response = await fetch(`${API}/transit/status`);
    if (!response.ok) return;
    const data = await response.json();
    let arrivals = data.arrivals || [];
    const filter = window.getBuzzuDepartureFilter?.();
    if (filter && typeof window.buzzuDepartureMatchesStop === 'function') {
      if (filter.stop) {
        arrivals = arrivals.filter((arrival) =>
          window.buzzuDepartureMatchesStop({ stop: `${arrival.stop} · ${arrival.direction}` }, filter.stop)
        );
      } else if (filter.regionId && typeof window.buzzuDepartureMatchesRegion === 'function') {
        arrivals = arrivals.filter((arrival) =>
          window.buzzuDepartureMatchesRegion(
            { stop: `${arrival.stop} · ${arrival.direction}`, name: arrival.name },
            filter.regionId
          )
        );
      }
    }
    const status = document.querySelector('.status-live strong');
    const updated = document.querySelector('.status-live span');
    if (status) status.textContent = data.operation === 'normal' ? 'Operação normal' : 'Atenção na operação';
    if (updated) updated.textContent = data.source === 'urbs' ? 'URBS · atualizado agora' : 'Modo demonstração';
    const items = document.querySelectorAll('.departure-item:not([aria-hidden="true"])');
    arrivals.slice(0, items.length).forEach((arrival, index) => {
      const item = items[index];
      if (!item) return;
      item.querySelector('.line-badge').textContent = arrival.line;
      item.querySelector('strong').textContent = arrival.name;
      item.querySelector('small').textContent = `${arrival.stop} · ${arrival.direction}`;
      item.querySelector('.arrival').textContent = `${arrival.minutes} min`;
    });
  } catch (error) {
    console.warn('API Buzzu indisponível; mantendo conteúdo local.', error);
  }
}

loadTransitStatus();

// ── Mapa SVG: tempos de chegada ao vivo nos cards dos pins ────
(function initMapCards() {
  const STATIONS = [
    { rowsId: 'rows-rodo', lines: [
      { badge:'203', name:'Expresso Santa Cândida', min:3,  color:'#db5a4b' },
      { badge:'502', name:'Expresso Leste',         min:7,  color:'#459b70' },
      { badge:'218', name:'Bacacheri / Centro',     min:11, color:'#4f82a0' },
    ]},
    { rowsId: 'rows-praca', lines: [
      { badge:'303', name:'Centenário / Campo Comprido', min:2,  color:'#459b70' },
      { badge:'022', name:'Interbairros II',              min:6,  color:'#c9a34b' },
      { badge:'280', name:'Campo Comprido / Batel',       min:10, color:'#db5a4b' },
    ]},
    { rowsId: 'rows-civico', lines: [
      { badge:'372', name:'Augusto Stresser',   min:4,  color:'#4f82a0' },
      { badge:'270', name:'Birigui / Água Verde', min:9, color:'#7b5ea7' },
      { badge:'500', name:'Linha Verde Norte',  min:12, color:'#459b70' },
    ]},
    { rowsId: 'rows-botanico', lines: [
      { badge:'510', name:'Vila Hauer / Boqueirão',   min:5,  color:'#2e9e5b' },
      { badge:'520', name:'Jd. Botânico / Rebouças',  min:8,  color:'#4f82a0' },
      { badge:'530', name:'Guabirotuba / Batel',      min:14, color:'#c9a34b' },
    ]},
  ];

  function render(station) {
    const el = document.getElementById(station.rowsId);
    if (!el) return;
    el.innerHTML = station.lines
      .slice().sort((a,b) => a.min - b.min)
      .map(l => `<div class="gmap-row">
        <span class="gmap-badge" style="background:${l.color}">${l.badge}</span>
        <span>${l.name}</span>
        <b>${l.min <= 0 ? 'Chegando' : l.min + ' min'}</b>
      </div>`).join('');
  }

  function tick() {
    STATIONS.forEach(s => {
      s.lines.forEach(l => {
        l.min--;
        if (l.min < 0) l.min = 5 + Math.floor(Math.random() * 10);
      });
      render(s);
    });
  }

  STATIONS.forEach(render);
  setInterval(tick, 20000);

  const PIN_DEPARTURE_STOPS = {
    'label-rodo': { name: 'Tubo Rodoferroviária', district: 'Centro' },
    'label-praca': { name: 'Tubo Praça Rui Barbosa', district: 'Centro' },
    'label-civico': { name: 'Tubo Centro Cívico', district: 'Centro Cívico' },
    'label-botanico': { name: 'Tubo Jardim Botânico', district: 'Jardim Botânico' },
  };

  document.querySelectorAll('.gmap-pin-label').forEach((label) => {
    label.addEventListener('click', () => {
      const card = label.querySelector('.gmap-card');
      if (card) card.classList.toggle('is-open');
      const pinClass = [...label.classList].find((cls) => cls.startsWith('label-'));
      const stop = pinClass ? PIN_DEPARTURE_STOPS[pinClass] : null;
      if (stop) {
        window.setBuzzuDepartureFilter?.({
          regionId: 'centro',
          stop,
          label: stop.name,
        });
        document.querySelector('[data-ops-map-region-label]')?.replaceChildren(document.createTextNode(stop.name));
      }
    });
  });
})();

// --- Scroll contínuo de chegadas: filtrado por região / tubo ---
(function initDepartureScroll() {
  const track = document.getElementById('departure-track');
  if (!track) return;

  const DEPARTURE_REGIONS = {
    centro: {
      label: 'Centro de Curitiba',
      districts: ['Centro', 'Centro Cívico', 'Seminário', 'Mercês'],
      keywords: ['centro', 'rodoferroviaria', 'rui barbosa', 'centro civico', 'civico', 'tiradentes', 'passeio publico'],
    },
    norte: {
      label: 'Região Norte',
      districts: ['Atuba', 'Bacacheri', 'Santa Cândida', 'Pilarzinho', 'Bairro Alto', 'Ahú', 'Juvevê', 'Tingui', 'Boa Vista', 'Abranches', 'Santa Felicidade', 'Lamenha Pequena', 'São Braz'],
      keywords: ['norte', 'atuba', 'bacacheri', 'santa candida', 'pilarzinho', 'bairro alto', 'juveve', 'tingui', 'boa vista', 'santa felicidade'],
    },
    leste: {
      label: 'Região Leste',
      districts: ['Pinheirinho', 'Boqueirão', 'Xaxim', 'Uberaba', 'Caiuá', 'Panorama', 'Orleans', 'Sítio Cercado', 'Hauer', 'Capão Raso', 'Guaíra', 'Lindóia'],
      keywords: ['leste', 'pinheirinho', 'boqueirao', 'xaxim', 'uberaba', 'orleans', 'sitio cercado', 'hauer', 'capao raso'],
    },
    oeste: {
      label: 'Região Oeste',
      districts: ['Campo Comprido', 'Portão', 'CIC', 'Cajuru', 'Guadalupe', 'Fazendinha', 'Tatuquara', 'Vila Capanema'],
      keywords: ['oeste', 'campo comprido', 'portao', 'cic', 'cajuru', 'guadalupe', 'fazendinha', 'tatuquara', 'capanema'],
    },
    sul: {
      label: 'Região Sul',
      districts: ['Água Verde', 'Jardim Botânico', 'Cabral', 'Batel', 'Rebouças', 'Champagnat', 'Cristo Rei', 'Santa Quitéria', 'Mossunguê', 'Higienópolis', 'Jardim das Américas', 'Kennedy', 'Novo Mundo', 'Vila Izabel', 'Bom Retiro', 'Major Heitor', 'Augusta'],
      keywords: ['sul', 'agua verde', 'jardim botanico', 'cabral', 'batel', 'reboucas', 'cristo rei', 'santa quiteria', 'novo mundo'],
    },
  };

  let departureFilter = {
    regionId: 'centro',
    stop: null,
    label: DEPARTURE_REGIONS.centro.label,
  };

  function normalizeDepartureText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stopSearchKeys(stop) {
    if (!stop) return [];
    const name = typeof stop === 'string' ? stop : stop.name;
    const district = typeof stop === 'object' ? stop.district : '';
    const normalizedName = normalizeDepartureText(name);
    const core = normalizedName.replace(/^(tubo|terminal|estacao|estacao integrada)\s+/i, '').trim();
    const keys = [core, normalizedName, normalizeDepartureText(district)].filter(Boolean);
    return [...new Set(keys)];
  }

  function lineHaystack(line) {
    return normalizeDepartureText(`${line.stop} ${line.name}`);
  }

  function lineMatchesStop(line, stop) {
    const hay = lineHaystack(line);
    return stopSearchKeys(stop).some((key) => key.length >= 3 && hay.includes(key));
  }

  function lineMatchesRegion(line, regionId) {
    const meta = DEPARTURE_REGIONS[regionId];
    if (!meta) return true;
    const hay = lineHaystack(line);
    if (meta.keywords.some((keyword) => hay.includes(normalizeDepartureText(keyword)))) return true;
    const catalog = window.__buzzuTransitStops || [];
    const regionalStops = catalog.filter((stop) => meta.districts.includes(stop.district));
    if (regionalStops.some((stop) => lineMatchesStop(line, stop))) return true;
    return meta.districts.some((district) => hay.includes(normalizeDepartureText(district)));
  }

  window.buzzuDepartureMatchesStop = lineMatchesStop;
  window.buzzuDepartureMatchesRegion = lineMatchesRegion;
  window.getBuzzuDepartureFilter = () => ({ ...departureFilter });

  const LINES = [
    { code: '101', name: 'Centro / Capão Raso',           stop: 'Terminal Capão Raso · Sentido centro',          color: '#db5a4b' },
    { code: '110', name: 'Terminal Boqueirão',             stop: 'Tubo Praça Rui Barbosa · Sentido bairro',       color: '#459b70' },
    { code: '172', name: 'Pinheirinho / Centro',           stop: 'Terminal Pinheirinho · Sentido centro',         color: '#4f82a0' },
    { code: '203', name: 'Expresso Santa Cândida',         stop: 'Tubo Rodoferroviária · Sentido norte',          color: '#db5a4b' },
    { code: '208', name: 'Circular Centro',                stop: 'Praça Tiradentes · Circular',                   color: '#c9a34b' },
    { code: '218', name: 'Bacacheri / Centro',             stop: 'Estação Cabral · Sentido centro',               color: '#459b70' },
    { code: '222', name: 'Bairro Alto / Rodoferroviária',  stop: 'Terminal Bairro Alto · Sentido sul',            color: '#4f82a0' },
    { code: '270', name: 'Birigui / Água Verde',           stop: 'Tubo Água Verde · Plataforma 1',                color: '#7b5ea7' },
    { code: '280', name: 'Campo Comprido / Batel',         stop: 'Estação Batel · Sentido bairro',                color: '#db5a4b' },
    { code: '290', name: 'Santa Felicidade / Centro',      stop: 'Terminal Santa Felicidade · Sentido centro',    color: '#459b70' },
    { code: '303', name: 'Centenário / Campo Comprido',    stop: 'Tubo Praça Rui Barbosa · Plataforma 2',         color: '#459b70' },
    { code: '311', name: 'Boa Vista / Centro',             stop: 'Terminal Boa Vista · Sentido centro',           color: '#c9a34b' },
    { code: '320', name: 'Cabral / Portão',                stop: 'Tubo Cabral · Sentido sul',                     color: '#4f82a0' },
    { code: '335', name: 'Cajuru / Rodoferroviária',       stop: 'Terminal Cajuru · Sentido centro',              color: '#db5a4b' },
    { code: '340', name: 'Cidade Industrial / Centro',     stop: 'Terminal CIC · Sentido centro',                 color: '#7b5ea7' },
    { code: '356', name: 'Sítio Cercado / Fazendinha',     stop: 'Terminal Sítio Cercado · Sentido bairro',       color: '#459b70' },
    { code: '372', name: 'Augusto Stresser',               stop: 'Estação Centro Cívico · Sentido bairro',        color: '#4f82a0' },
    { code: '380', name: 'Uberaba / Centro',               stop: 'Terminal Uberaba · Sentido centro',             color: '#db5a4b' },
    { code: '390', name: 'Xaxim / Portão',                 stop: 'Terminal Xaxim · Sentido bairro',               color: '#c9a34b' },
    { code: '400', name: 'Prado Velho / Rebouças',         stop: 'Tubo Rebouças · Sentido bairro',                color: '#459b70' },
    { code: '414', name: 'Tatuquara / Centro',             stop: 'Terminal Tatuquara · Sentido centro',           color: '#4f82a0' },
    { code: '418', name: 'Tingui / Ahú',                   stop: 'Terminal Tingui · Sentido bairro',              color: '#7b5ea7' },
    { code: '022', name: 'Interbairros II',                stop: 'Tubo Passeio Público · Sentido sul',            color: '#c9a34b' },
    { code: '023', name: 'Interbairros III',               stop: 'Terminal Portão · Circular bairros',            color: '#db5a4b' },
    { code: '500', name: 'Linha Verde Norte',              stop: 'Estação Marechal Floriano · Sentido norte',     color: '#2e9e5b' },
    { code: '501', name: 'Linha Verde Sul',                stop: 'Estação Marechal Floriano · Sentido sul',       color: '#2e9e5b' },
    { code: '502', name: 'Expresso Leste',                 stop: 'Terminal Guadalupe · Sentido centro',           color: '#db5a4b' },
    { code: '503', name: 'Expresso Oeste',                 stop: 'Terminal Campo Comprido · Sentido centro',      color: '#459b70' },
    { code: '510', name: 'Vila Hauer / Boqueirão',         stop: 'Terminal Boqueirão · Sentido bairro',           color: '#4f82a0' },
    { code: '520', name: 'Jardim Botânico / Rebouças',     stop: 'Tubo Jardim Botânico · Sentido centro',         color: '#7b5ea7' },
    { code: '530', name: 'Guabirotuba / Batel',            stop: 'Estação Batel · Plataforma 3',                  color: '#c9a34b' },
    { code: '540', name: 'Fazendinha / Portão',            stop: 'Terminal Fazendinha · Sentido bairro',          color: '#db5a4b' },
    { code: '550', name: 'Orleans / Rodoferroviária',      stop: 'Terminal Orleans · Sentido centro',             color: '#459b70' },
    { code: '560', name: 'Hugo Lange / Juvevê',            stop: 'Tubo Cabral · Sentido norte',                   color: '#4f82a0' },
    { code: '570', name: 'Pinheirinho / CIC',              stop: 'Terminal Pinheirinho · Sentido bairro',         color: '#7b5ea7' },
    { code: '580', name: 'Santa Quitéria / Centro',        stop: 'Tubo Batel · Sentido centro',                   color: '#c9a34b' },
    { code: '590', name: 'Novo Mundo / Portão',            stop: 'Terminal Portão · Plataforma 4',                color: '#db5a4b' },
    { code: '600', name: 'Riviera / Boqueirão',            stop: 'Terminal Boqueirão · Sentido bairro',           color: '#459b70' },
    { code: '610', name: 'Umbará / Pinheirinho',           stop: 'Terminal Umbará · Sentido centro',              color: '#4f82a0' },
    { code: '620', name: 'Tarumã / Cabral',                stop: 'Tubo Cabral · Plataforma 1',                    color: '#7b5ea7' },
    { code: '630', name: 'Atuba / Santa Cândida',          stop: 'Terminal Santa Cândida · Sentido sul',          color: '#c9a34b' },
    { code: '640', name: 'São Braz / CIC',                 stop: 'Terminal São Braz · Sentido bairro',            color: '#db5a4b' },
    { code: '650', name: 'Vista Alegre / Boa Vista',       stop: 'Terminal Boa Vista · Plataforma 2',             color: '#459b70' },
    { code: '660', name: 'Pilarzinho / Tingui',            stop: 'Terminal Tingui · Sentido centro',              color: '#4f82a0' },
    { code: '670', name: 'Mercês / Batel',                 stop: 'Tubo Batel · Sentido bairro',                   color: '#7b5ea7' },
    { code: '680', name: 'Capão da Imbuia / Cajuru',       stop: 'Terminal Cajuru · Plataforma 3',                color: '#c9a34b' },
    { code: '690', name: 'Hauer / Boqueirão',              stop: 'Terminal Boqueirão · Sentido norte',            color: '#db5a4b' },
    { code: '700', name: 'São João / Centro Cívico',       stop: 'Estação Centro Cívico · Sentido bairro',        color: '#459b70' },
    { code: '710', name: 'Caximba / Tatuquara',            stop: 'Terminal Tatuquara · Plataforma 1',             color: '#4f82a0' },
    { code: '720', name: 'Ganchinho / Sítio Cercado',      stop: 'Terminal Sítio Cercado · Sentido centro',       color: '#7b5ea7' },
  ];

  function linesForFilter() {
    let filtered = LINES;
    if (departureFilter.stop) {
      filtered = LINES.filter((line) => lineMatchesStop(line, departureFilter.stop));
      if (filtered.length < 5 && departureFilter.stop.district) {
        const district = normalizeDepartureText(departureFilter.stop.district);
        filtered = LINES.filter(
          (line) => lineMatchesStop(line, departureFilter.stop) || lineHaystack(line).includes(district)
        );
      }
    } else if (departureFilter.regionId) {
      filtered = LINES.filter((line) => lineMatchesRegion(line, departureFilter.regionId));
    }
    if (!filtered.length) filtered = LINES.slice(0, 14);
    return filtered;
  }

  function buildItems() {
    return linesForFilter()
      .map((line) => ({
        ...line,
        minutes: Math.floor(Math.random() * 30) + 1,
      }))
      .sort((a, b) => a.minutes - b.minutes);
  }

  function renderItem(item, hidden = false) {
    const div = document.createElement('div');
    div.className = 'departure-item';
    if (hidden) div.setAttribute('aria-hidden', 'true');
    div.innerHTML = `
      <div class="line-badge" style="background:${item.color}">${item.code}</div>
      <div><strong>${item.name}</strong><small>${item.stop}</small></div>
      <b class="arrival">${item.minutes} min</b>`;
    return div;
  }

  function populate() {
    const items = buildItems();
    track.classList.remove('is-running');
    track.innerHTML = '';

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'departure-item departure-item-empty';
      empty.innerHTML = '<div><strong>Nenhuma linha neste ponto agora</strong><small>Tente outro tubo ou região no mapa</small></div>';
      track.appendChild(empty);
      return;
    }

    items.forEach((item) => track.appendChild(renderItem(item)));
    items.forEach((item) => track.appendChild(renderItem(item, true)));

    requestAnimationFrame(() => {
      const half = track.scrollHeight / 2;
      const dur = Math.max(24, Math.round(items.length * 2.2));
      track.style.setProperty('--scroll-dur', `${dur}s`);
      track.style.setProperty('--scroll-half', `${half}px`);
      track.classList.add('is-running');
    });
    loadTransitStatus();
  }

  window.setBuzzuDepartureFilter = function setBuzzuDepartureFilter(next = {}) {
    let regionId = next.regionId;
    if (!regionId && next.stop?.district) {
      const match = Object.entries(DEPARTURE_REGIONS).find(([, meta]) =>
        meta.districts.includes(next.stop.district)
      );
      regionId = match?.[0];
    }
    regionId = regionId || departureFilter.regionId || 'centro';
    const regionLabel = DEPARTURE_REGIONS[regionId]?.label || 'Curitiba';
    departureFilter = {
      regionId,
      stop: next.stop || null,
      label: next.label || (next.stop?.name ? next.stop.name : regionLabel),
    };
    populate();
  };

  populate();
  setInterval(() => populate(), 60000);
})();

// Autocomplete do formulário

searchToggle?.addEventListener('click', () => {
  searchDrawer.classList.add('is-open');
  searchResults.hidden = false;
  renderSearchResults(globalSearch?.value || '');
  globalSearch?.focus();
});
searchClose?.addEventListener('click', () => { searchDrawer.classList.remove('is-open'); searchResults.hidden = true; });

function closeRouteAutocompletePanels() {
  document.querySelectorAll('.route-autocomplete.is-open').forEach((panel) => {
    panel.classList.remove('is-open');
  });
}

document.querySelector('[data-route-search]')?.addEventListener('click', async () => {
  closeRouteAutocompletePanels();
  const from = originInput?.value.trim() || '';
  const to = destinationInput?.value.trim() || '';
  const hasOriginCoords = Boolean(originInput?.dataset.coordinates);
  const button = document.querySelector('[data-route-search]');
  const resultsPanel = document.getElementById('route-results-panel');
  const validationError = validateRouteSearch({ from, to, hasOriginCoords });
  if (validationError) {
    setRouteNote(validationError);
    resultsPanel?.classList.remove('is-visible');
    if (resultsPanel) resultsPanel.innerHTML = '';
    return;
  }
  if (!transitLinesCatalog.length) await loadTransitLinesCatalog();

  const fromLabel = from || 'Minha localização';
  const now = new Date();
  const departures = [
    'Agora',
    `${String(now.getHours()).padStart(2, '0')}:${String((now.getMinutes() + 3) % 60).padStart(2, '0')}`,
    `${String(now.getHours()).padStart(2, '0')}:${String((now.getMinutes() + 9) % 60).padStart(2, '0')}`,
  ];

  button.disabled = true;
  const previousLabel = button.innerHTML;
  button.innerHTML = 'Calculando rota <span>…</span>';

  let plan = null;
  try {
    let originLatLng = originInput?.dataset.coordinates || null;
    if (typeof originLatLng === 'string' && originLatLng.includes(',')) {
      const [lat, lon] = originLatLng.split(',').map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lon)) originLatLng = { lat, lon };
    }
    try {
      plan = await requestRoutePlan({ from, to, originLatLng });
    } catch (apiError) {
      if (typeof window.buildBuzzuFallbackPlan === 'function') {
        plan = window.buildBuzzuFallbackPlan({
          from,
          to,
          fromLabel,
          originLatLng,
          lines: transitLinesCatalog,
          stops: window.__buzzuTransitStops || [],
          meta: transitLinesMeta,
        });
        if (!plan?.options?.length) throw apiError;
        setRouteNote('Modo local: mapa e itinerários calculados no navegador (API indisponível).');
      } else {
        throw apiError;
      }
    }
  } catch (error) {
    setRouteNote(error.message);
    resultsPanel?.classList.remove('is-visible');
    if (resultsPanel) resultsPanel.innerHTML = '';
    button.disabled = false;
    button.innerHTML = previousLabel;
    return;
  }

  if (resultsPanel && typeof window.renderBuzzuRouteResults === 'function') {
    window.renderBuzzuRouteResults(plan, resultsPanel, departures);
    resultsPanel.classList.add('is-visible');
    resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else if (resultsPanel) {
    setRouteNote('Painel de mapa não carregou. Recarregue a página (Ctrl+F5).');
    button.disabled = false;
    button.innerHTML = previousLabel;
    return;
  }

  button.innerHTML = 'Rota encontrada <span>✓</span>';
  button.style.background = '#2f9466';
  button.disabled = false;
  setTimeout(() => {
    button.innerHTML = 'Encontrar rota <span>→</span>';
    button.style.background = '';
  }, 2600);
  setRouteNote(`${fromLabel} → ${to} · ${plan.options[0].timeMinutes} min. Veja o mapa e as etapas abaixo.`);
});

document.querySelector('[data-route-focus]')?.addEventListener('click', () => {
  document.querySelector('#from')?.focus();
  window.scrollTo({ top: document.querySelector('.hero').offsetTop, behavior: 'smooth' });
});

// ── Formulário multi-etapas ───────────────────────────────────
(function initMultiStepForm() {
  const form = document.getElementById('signup-form');
  if (!form) return;

  const fieldsets = form.querySelectorAll('.form-fieldset');
  const stepItems = document.querySelectorAll('.form-step-item');

  function goTo(stepNum) {
    fieldsets.forEach(fs => fs.classList.add('is-hidden'));
    const target = form.querySelector(`[data-fieldset="${stepNum}"]`);
    if (target) target.classList.remove('is-hidden');

    stepItems.forEach(item => {
      const n = parseInt(item.dataset.step);
      item.classList.remove('active', 'done');
      if (n < stepNum) item.classList.add('done');
      if (n === stepNum) item.classList.add('active');
    });

    // Popula revisão na etapa 3
    if (stepNum === 3) buildReview();
  }

  function validateFieldset(fs) {
    const inputs = fs.querySelectorAll('input[required]');
    let valid = true;
    inputs.forEach(input => {
      if (!input.checkValidity()) {
        input.classList.add('was-touched');
        valid = false;
      }
    });
    // Verifica senhas iguais na etapa 2
    if (fs.dataset.fieldset === '2') {
      const pw = form.querySelector('#password');
      const pwc = form.querySelector('#password-confirm');
      if (pw && pwc && pw.value !== pwc.value) {
        pwc.setCustomValidity('As senhas não coincidem.');
        pwc.classList.add('was-touched');
        valid = false;
      } else if (pwc) {
        pwc.setCustomValidity('');
      }
    }
    return valid;
  }

  function buildReview() {
    const review = document.getElementById('form-review');
    if (!review) return;
    const data = {
      'Nome': form.querySelector('[name="name"]')?.value || '—',
      'CPF': form.querySelector('[name="cpf"]')?.value || '—',
      'Nascimento': form.querySelector('[name="birth"]')?.value || '—',
      'Celular': form.querySelector('[name="phone"]')?.value || '—',
      'CEP': form.querySelector('[name="cep"]')?.value || '—',
      'E-mail': form.querySelector('[name="email"]')?.value || '—',
    };
    review.innerHTML = Object.entries(data).map(([label, value]) =>
      `<div class="review-item"><strong>${label}</strong><span>${value}</span></div>`
    ).join('');
  }

  // Botões próximo
  form.querySelectorAll('.form-next').forEach(btn => {
    btn.addEventListener('click', () => {
      const currentFs = form.querySelector(`.form-fieldset:not(.is-hidden)`);
      if (!validateFieldset(currentFs)) {
        currentFs.querySelector('input:invalid')?.focus();
        return;
      }
      goTo(parseInt(btn.dataset.next));
    });
  });

  // Botões voltar
  form.querySelectorAll('.form-back').forEach(btn => {
    btn.addEventListener('click', () => goTo(parseInt(btn.dataset.back)));
  });

  // Toggle mostrar/ocultar senha
  form.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
        btn.setAttribute('aria-label', 'Ocultar senha');
      } else {
        input.type = 'password';
        btn.textContent = '👁';
        btn.setAttribute('aria-label', 'Mostrar senha');
      }
    });
  });

  // Máscara simples de CPF
  form.querySelector('[name="cpf"]')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{0,3})/, '$1.$2');
    e.target.value = v;
  });

  // Máscara de CEP
  form.querySelector('[name="cep"]')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 8);
    if (v.length > 5) v = v.replace(/(\d{5})(\d{0,3})/, '$1-$2');
    e.target.value = v;
  });
})();

document.querySelector('#signup-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.querySelector('.form-message');
  const button = event.currentTarget.querySelector('button');
  if (!event.currentTarget.checkValidity()) {
    event.currentTarget.querySelectorAll('input').forEach(field => field.classList.add('was-touched'));
    message.textContent = 'Revise os campos destacados antes de continuar.';
    event.currentTarget.reportValidity();
    return;
  }
  button.disabled = true;
  button.innerHTML = 'Criando sua conta <span>...</span>';
  try {
    const response = await fetch(`${API}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível concluir o cadastro.');
    localStorage.setItem('buzu_token', result.token);
    message.textContent = `Conta criada, ${result.user.name.split(' ')[0]}.`;
    button.innerHTML = 'Cadastro iniciado <span>✓</span>';
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
  }
});

document.querySelector('.refresh')?.addEventListener('click', (event) => {
  const button = event.currentTarget;
  button.textContent = '✓';
  setTimeout(() => { button.textContent = '↻'; }, 1200);
});

document.querySelector('[data-menu-toggle]')?.addEventListener('click', () => {
  const navigation = document.querySelector('.main-nav');
  const isOpen = navigation.classList.toggle('mobile-open');
  if (window.matchMedia('(max-width: 700px)').matches) {
    navigation.style.cssText = isOpen
      ? 'display:flex;position:absolute;top:71px;left:0;right:0;padding:20px 7%;flex-direction:column;gap:19px;background:var(--paper);border-bottom:1px solid var(--line);box-shadow:0 12px 22px rgba(16,36,48,.08);z-index:4'
      : '';
  }
});

routeInputs.forEach((input) => input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    const openPanel = input.closest('.route-field')?.querySelector('.route-autocomplete.is-open');
    const selected = openPanel?.querySelector('.route-autocomplete-item.is-selected');
    if (selected) {
      event.preventDefault();
      selected.click();
      return;
    }
    document.querySelector('[data-route-search]')?.click();
  }
}));

(function initRouteAutocomplete() {
  const placeCatalog = [
    { icon: 'T', name: 'Tubo Rodoferroviária', detail: 'Estação principal · 12 plataformas', type: 'Tubo', address: 'Rodoferroviária de Curitiba' },
    { icon: 'T', name: 'Tubo Praça Rui Barbosa', detail: 'Calçadão da XV · 18 tubos', type: 'Tubo', address: 'Praça Rui Barbosa, Centro' },
    { icon: 'T', name: 'Tubo Centro Cívico', detail: 'Próx. Palácio do Governo · 6 plataformas', type: 'Tubo', address: 'Av. Cândido de Abreu' },
    { icon: 'T', name: 'Tubo Jardim Botânico', detail: 'Estufa Art Nouveau · Visitação livre', type: 'Tubo', address: 'Rua Engenheiro Ostoja Roguski' },
    { icon: 'T', name: 'Tubo Batel', detail: 'Plataformas 1, 2 e 3', type: 'Tubo', address: 'Av. do Batel' },
    { icon: 'T', name: 'Tubo Cabral', detail: 'Sentidos norte e sul', type: 'Tubo', address: 'R. Carlos de Carvalho' },
    { icon: 'T', name: 'Tubo Rebouças', detail: 'Sentido bairro · 4 plataformas', type: 'Tubo', address: 'Av. Sete de Setembro' },
    { icon: 'T', name: 'Tubo Passeio Público', detail: 'Interbairros II · Sentido sul', type: 'Tubo', address: 'R. José Bonifácio' },
    { icon: 'T', name: 'Tubo Água Verde', detail: 'Plataforma 1 · Linha 270', type: 'Tubo', address: 'Av. República Argentina' },
    { icon: 'P', name: 'Praça Rui Barbosa', detail: 'Centro de Curitiba', type: 'Praça', address: 'Centro' },
    { icon: 'P', name: 'Praça Tiradentes', detail: 'Ao lado do Paço Municipal', type: 'Praça', address: 'R. José Bonifácio' },
    { icon: 'P', name: 'Praça do Japão', detail: 'Bairro Alto · Jardim japonês', type: 'Praça', address: 'Bairro Alto' },
    { icon: 'L', name: 'Linha 303 - Centenário', detail: 'Centenário / Campo Comprido', type: 'Linha', address: 'Expresso' },
    { icon: 'L', name: 'Linha 203 - Santa Cândida', detail: 'Expresso Santa Cândida', type: 'Linha', address: 'Rodoferroviária' },
    { icon: 'L', name: 'Linha 500 - Linha Verde', detail: 'Linha Verde Norte', type: 'Linha', address: 'Marechal Floriano' },
    { icon: 'L', name: 'Linha 022 - Interbairros II', detail: 'Interbairros II via Passeio Público', type: 'Linha', address: 'Circular' },
    { icon: 'L', name: 'Linha 502 - Expresso Leste', detail: 'Terminal Guadalupe / Centro', type: 'Linha', address: 'Expresso' },
    { icon: 'L', name: 'Linha 372 - Augusto Stresser', detail: 'Centro Cívico / Augusto Stresser', type: 'Linha', address: 'Alimentador' },
    { icon: 'L', name: 'Linha 280 - Campo Comprido', detail: 'Campo Comprido / Batel', type: 'Linha', address: 'Alimentador' },
    { icon: 'L', name: 'Linha 270 - Birigui', detail: 'Birigui / Água Verde', type: 'Linha', address: 'Alimentador' },
    { icon: 'L', name: 'Linha 510 - Vila Hauer', detail: 'Vila Hauer / Boqueirão', type: 'Linha', address: 'Alimentador' },
    { icon: 'L', name: 'Linha 520 - Jardim Botânico', detail: 'Jd. Botânico / Rebouças', type: 'Linha', address: 'Alimentador' },
  ];

  neighborhoodNames.forEach((name, idx) => {
    placeCatalog.push({
      icon: 'B',
      name: name,
      detail: 'Bairro de Curitiba',
      type: 'Bairro',
      address: neighborhoodCoordinates[name] ? `Curitiba - PR` : 'Curitiba - PR'
    });
    if (idx >= 25) return;
  });

  const landmarks = [
    { icon: '★', name: 'Jardim Botânico de Curitiba', detail: 'Estufa Art Nouveau e jardins', type: 'Ponto', address: 'R. Eng. Ostoja Roguski, s/nº' },
    { icon: '★', name: 'Passeio Público', detail: 'Parque histórico do Centro', type: 'Ponto', address: 'Av. Sete de Setembro' },
    { icon: '★', name: 'Museu Oscar Niemeyer (MON)', detail: 'Museu do Olho · Arte contemporânea', type: 'Ponto', address: 'R. Marechal Hermes, 999' },
    { icon: '★', name: 'Opera de Arame', detail: 'Teatro de estrutura tubular', type: 'Ponto', address: 'Parque das Pedreiras' },
    { icon: '★', name: 'Rua XV de Novembro', detail: 'Calçadão do Centro', type: 'Ponto', address: 'Centro de Curitiba' },
    { icon: '★', name: 'Palácio Avenida', detail: 'Prédio histórico · Centro', type: 'Ponto', address: 'Av. Luiz Xavier' },
    { icon: '★', name: 'Centro Cívico', detail: 'Palácio do Governo e Assembleia', type: 'Ponto', address: 'Av. Cândido de Abreu' },
    { icon: '★', name: 'Parque Tanguá', detail: 'Dois lagos e mirante', type: 'Ponto', address: 'R. Oswaldo Maciel, 857' },
    { icon: '★', name: 'Parque Barigüi', detail: 'Grande parque urbano', type: 'Ponto', address: 'Av. Cândido Hartmann' },
    { icon: '★', name: 'Parque Iguaçu', detail: 'Zoológico e bosques', type: 'Ponto', address: 'Av. Mal. H. de Castelo Branco' },
    { icon: '★', name: 'Bosque Alemão', detail: 'Trilhas e biblioteca florestal', type: 'Ponto', address: 'R. Francisco Schaffer' },
    { icon: '★', name: 'Bosque de Portugal', detail: 'Área verde e trilhas', type: 'Ponto', address: 'R. Riviera, s/nº' },
    { icon: '★', name: 'Shopping Curitiba', detail: 'Av. Sete de Setembro', type: 'Shopping', address: 'Av. Sete de Setembro, 4200' },
    { icon: '★', name: 'Shopping Mueller', detail: 'Centro de Curitiba', type: 'Shopping', address: 'Av. Luiz Xavier, 153' },
    { icon: '★', name: 'Shopping Estação', detail: 'Rodoferroviária', type: 'Shopping', address: 'Av. Sete de Setembro, 2775' },
    { icon: '★', name: 'Rodoferroviária de Curitiba', detail: 'Terminal rodoviário e ferroviário', type: 'Terminal', address: 'Av. Sete de Setembro' },
    { icon: '★', name: 'Aeroporto Afonso Pena', detail: 'Aeroporto internacional de Curitiba', type: 'Aeroporto', address: 'São José dos Pinhais' },
    { icon: '★', name: 'Universidade Federal do Paraná (UFPR)', detail: 'Campus Centro · Reitoria', type: 'Universidade', address: 'R. XV de Novembro, 1299' },
    { icon: '★', name: 'PUCPR - Pontifícia Universidade Católica', detail: 'Campus Prado Velho', type: 'Universidade', address: 'R. Imaculada Conceição, 1155' },
    { icon: '★', name: 'Hospital de Clínicas (HC UFPR)', detail: 'Hospital universitário', type: 'Hospital', address: 'R. General Carneiro, 181' },
    { icon: '★', name: 'Hospital Erasto Gaertner', detail: 'Hospital oncológico', type: 'Hospital', address: 'R. Dr. Erasto Gaertner, 277' },
    { icon: '★', name: 'Estádio Couto Pereira', detail: 'Stadium do Coritiba FC', type: 'Estádio', address: 'R. Ubaldino do Amaral, 37' },
    { icon: '★', name: 'Arena da Baixada', detail: 'Stadium do Athletico Paranaense', type: 'Estádio', address: 'R. Buenos Aires, 1266' },
  ];

  landmarks.forEach(l => placeCatalog.push(l));

  function setupAutocomplete(input) {
    const field = input.closest('.route-field');
    if (!field) return;

    let panel = field.querySelector('.route-autocomplete');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'route-autocomplete';
      panel.setAttribute('role', 'listbox');
      field.appendChild(panel);
    }

    let activeIndex = -1;
    let currentItems = [];
    const MIN_QUERY_CHARS = 2;

    function render(query = '') {
      const normalized = query.trim().toLowerCase();
      if (normalized.length < MIN_QUERY_CHARS) {
        currentItems = [];
        activeIndex = -1;
        panel.innerHTML = '';
        close();
        return;
      }
      const matches = placeCatalog
        .filter(item => `${item.name} ${item.detail} ${item.address} ${item.type}`.toLowerCase().includes(normalized))
        .slice(0, 5);

      currentItems = matches;
      activeIndex = -1;

      if (matches.length === 0) {
        panel.innerHTML = `<div class="route-autocomplete-empty">Nenhum resultado encontrado para "${query}".</div>`;
      } else {
        panel.innerHTML = matches.map((item, index) => `
          <button type="button" class="route-autocomplete-item" role="option" data-index="${index}" aria-selected="false">
            <span class="route-autocomplete-icon">${item.icon}</span>
            <span class="route-autocomplete-copy"><strong>${item.name}</strong><small>${item.detail}</small></span>
            <span class="route-autocomplete-type">${item.type}</span>
          </button>
        `).join('');

        panel.querySelectorAll('.route-autocomplete-item').forEach(item => {
          item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.index);
            const chosen = currentItems[idx];
            if (chosen) {
              input.value = chosen.name;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              close();
              input.focus();
            }
          });

          item.addEventListener('mouseenter', () => {
            const idx = parseInt(item.dataset.index);
            setActive(idx);
          });
        });
      }
      open();
    }

    function setActive(idx) {
      const all = panel.querySelectorAll('.route-autocomplete-item');
      all.forEach(i => { i.classList.remove('is-selected'); i.setAttribute('aria-selected', 'false'); });
      activeIndex = idx;
      if (activeIndex >= 0 && all[activeIndex]) {
        all[activeIndex].classList.add('is-selected');
        all[activeIndex].setAttribute('aria-selected', 'true');
        all[activeIndex].scrollIntoView({ block: 'nearest' });
      }
    }

    function open() {
      if (currentItems.length === 0 && !panel.querySelector('.route-autocomplete-empty')) return;
      panel.classList.add('is-open');
    }

    function close() {
      panel.classList.remove('is-open');
      activeIndex = -1;
    }

    input.addEventListener('focus', () => {
      // Não abre sugestões automáticas no focus — preserva acessibilidade e layout
    });

    input.addEventListener('input', () => {
      render(input.value);
    });

    input.addEventListener('keydown', (e) => {
      const total = currentItems.length;
      if (e.key === 'ArrowDown' && total > 0) {
        e.preventDefault();
        if (!panel.classList.contains('is-open')) open();
        setActive((activeIndex + 1) % total);
      } else if (e.key === 'ArrowUp' && total > 0) {
        e.preventDefault();
        setActive(activeIndex <= 0 ? total - 1 : activeIndex - 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });

    document.addEventListener('click', (e) => {
      if (!field.contains(e.target)) close();
    });
  }

  setupAutocomplete(originInput);
  setupAutocomplete(destinationInput);

  window.__buzzuExtendPlaceCatalog = (stops) => {
    (stops || []).forEach((stop) => {
      if (placeCatalog.some((item) => item.name === stop.name)) return;
      placeCatalog.push({
        icon: 'T',
        name: stop.name,
        detail: [stop.district, stop.platforms ? `${stop.platforms} plataformas` : ''].filter(Boolean).join(' · ') || stop.address,
        type: stop.kind === 'estacao' ? 'Estação' : stop.kind === 'terminal' ? 'Terminal' : 'Tubo',
        address: stop.address || stop.district || 'Curitiba - PR'
      });
    });
  };

  window.__buzzuExtendTransitLines = (lines) => {
    (lines || []).forEach((line) => {
      const label = `Linha ${line.code} - ${line.name}`;
      if (placeCatalog.some((item) => item.name === label)) return;
      const summary = lineRouteSummary(line);
      placeCatalog.push({
        icon: 'L',
        name: label,
        detail: summary.route,
        type: 'Linha',
        address: summary.itinerary || 'Curitiba - PR'
      });
    });
  };

  window.__buzzuExtendTransitLines(transitLinesCatalog);
})();

(function initRouteTuboPicker() {
  const modal = document.getElementById('tubo-picker-modal');
  const panel = document.getElementById('tubo-picker-panel');
  const trigger = document.getElementById('tubo-picker-open');
  if (!modal || !panel || !trigger) return;

  let stops = [];
  let activeTarget = 'from';

  function kindLabel(kind) {
    if (kind === 'estacao') return 'Estação';
    if (kind === 'terminal') return 'Terminal';
    return 'Tubo';
  }

  function setActiveTarget(targetId) {
    activeTarget = targetId === 'to' ? 'to' : 'from';
    panel.querySelectorAll('[data-tubo-target]').forEach((button) => {
      const isActive = button.dataset.tuboTarget === activeTarget;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });
  }

  function closePanel() {
    panel.hidden = true;
    modal.hidden = true;
    document.body.classList.remove('tubo-picker-modal-open');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
  }

  function openPanel() {
    const opsModal = document.getElementById('ops-map-modal');
    if (opsModal && !opsModal.hidden) {
      opsModal.hidden = true;
      document.getElementById('ops-map-region-panel')?.setAttribute('hidden', '');
      document.getElementById('ops-map-region-open')?.setAttribute('aria-expanded', 'false');
    }
    if (document.activeElement === destinationInput) setActiveTarget('to');
    else if (document.activeElement === originInput) setActiveTarget('from');
    modal.hidden = false;
    panel.hidden = false;
    document.body.classList.add('tubo-picker-modal-open');
    trigger.setAttribute('aria-expanded', 'true');
    const filter = panel.querySelector('.tubo-picker-filter');
    if (filter) filter.value = '';
    renderList();
    filter?.focus();
  }

  function renderList(filter = '') {
    const list = panel.querySelector('.tubo-picker-list');
    if (!list) return;
    const normalized = filter.trim().toLowerCase();
    const matches = stops
      .filter((stop) =>
        `${stop.name} ${stop.address} ${stop.district} ${stop.kind || ''}`.toLowerCase().includes(normalized)
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    list.innerHTML = '';
    if (!matches.length) {
      const empty = document.createElement('li');
      empty.className = 'tubo-picker-empty';
      empty.textContent = normalized ? `Nenhum ponto encontrado para "${filter.trim()}".` : 'Nenhum tubo cadastrado.';
      list.appendChild(empty);
      return;
    }

    matches.forEach((stop) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tubo-picker-option';
      button.setAttribute('role', 'option');

      const name = document.createElement('span');
      name.className = 'tubo-picker-option-name';
      name.textContent = stop.name;

      const meta = document.createElement('span');
      meta.className = 'tubo-picker-option-meta';
      const kind = document.createElement('span');
      kind.className = 'tubo-picker-option-kind';
      kind.textContent = kindLabel(stop.kind);
      meta.append(kind, document.createTextNode([stop.district, stop.address].filter(Boolean).join(' · ')));

      button.append(name, meta);
      button.addEventListener('click', () => {
        const input = document.getElementById(activeTarget);
        if (input) {
          input.value = stop.name;
          if (activeTarget === 'from') {
            originCoordinates = '';
            delete input.dataset.coordinates;
            const locationButton = document.getElementById('use-my-location');
            locationButton?.classList.remove('is-active');
            if (locationButton) locationButton.textContent = 'Usar minha localização';
          }
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.focus();
        }
        window.setBuzzuDepartureFilter?.({ stop, label: stop.name });
        closePanel();
      });

      item.appendChild(button);
      list.appendChild(item);
    });
  }

  originInput?.addEventListener('focus', () => setActiveTarget('from'));
  destinationInput?.addEventListener('click', () => setActiveTarget('to'));
  originInput?.addEventListener('click', () => setActiveTarget('from'));
  destinationInput?.addEventListener('focus', () => setActiveTarget('to'));

  panel.querySelectorAll('[data-tubo-target]').forEach((button) => {
    button.addEventListener('click', () => setActiveTarget(button.dataset.tuboTarget));
  });

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    if (modal.hidden) openPanel();
    else closePanel();
  });

  modal.querySelectorAll('[data-tubo-picker-close]').forEach((button) => {
    button.addEventListener('click', closePanel);
  });
  panel.querySelector('.tubo-picker-filter')?.addEventListener('input', (event) => {
    renderList(event.target.value);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closePanel();
  });

  (async () => {
    for (const base of resolveApiBases()) {
      try {
        const response = await fetch(`${base}/transit/stops`);
        if (!response.ok) continue;
        return readJsonResponse(response);
      } catch {
        // tenta próxima base
      }
    }
    throw new Error('Falha ao carregar tubos');
  })()
    .then((payload) => {
      stops = payload.stops || [];
      window.__buzzuTransitStops = stops;
      const sourceLabel = payload.source === 'urbs' ? 'URBS' : 'Buzzu';
      const suffix = payload.warning ? ' · fallback local' : '';
      panel.querySelector('[data-tubo-source]').textContent =
        `${stops.length} pontos em Curitiba · referência ${sourceLabel} / sistema integrado${suffix}`;
      window.__buzzuExtendPlaceCatalog?.(stops);
      renderList();
      window.dispatchEvent(new CustomEvent('buzzu:stops-loaded', { detail: stops }));
    })
    .catch(() => {
      panel.querySelector('[data-tubo-source]').textContent = 'Não foi possível carregar a lista de tubos.';
    });
})();

(function initOpsMapRegionPicker() {
  const modal = document.getElementById('ops-map-modal');
  const panel = document.getElementById('ops-map-region-panel');
  const trigger = document.getElementById('ops-map-region-open');
  const mapArt = document.getElementById('map-art');
  const labelEl = document.querySelector('[data-ops-map-region-label]');
  if (!modal || !panel || !trigger || !mapArt) return;

  const OPS_REGIONS = [
    {
      id: 'centro',
      name: 'Centro de Curitiba',
      summary: 'Núcleo histórico, XV e Centro Cívico',
      districts: ['Centro', 'Centro Cívico', 'Seminário', 'Mercês'],
      pins: ['rodo', 'praca', 'civico', 'botanico'],
    },
    {
      id: 'norte',
      name: 'Região Norte',
      summary: 'Atuba, Bacacheri, Santa Cândida e entorno',
      districts: ['Atuba', 'Bacacheri', 'Santa Cândida', 'Pilarzinho', 'Bairro Alto', 'Ahú', 'Juvevê', 'Tingui', 'Boa Vista', 'Abranches', 'Santa Felicidade', 'Lamenha Pequena', 'São Braz'],
      pins: [],
    },
    {
      id: 'leste',
      name: 'Região Leste',
      summary: 'Pinheirinho, Boqueirão, Xaxim e entorno',
      districts: ['Pinheirinho', 'Boqueirão', 'Xaxim', 'Uberaba', 'Caiuá', 'Panorama', 'Orleans', 'Sítio Cercado', 'Hauer', 'Capão Raso', 'Guaíra', 'Lindóia'],
      pins: [],
    },
    {
      id: 'oeste',
      name: 'Região Oeste',
      summary: 'Campo Comprido, Portão, CIC e entorno',
      districts: ['Campo Comprido', 'Portão', 'CIC', 'Cajuru', 'Guadalupe', 'Fazendinha', 'Tatuquara', 'Vila Capanema'],
      pins: [],
    },
    {
      id: 'sul',
      name: 'Região Sul',
      summary: 'Água Verde, Batel, Cabral e entorno',
      districts: ['Água Verde', 'Jardim Botânico', 'Cabral', 'Batel', 'Rebouças', 'Champagnat', 'Cristo Rei', 'Santa Quitéria', 'Mossunguê', 'Higienópolis', 'Jardim das Américas', 'Kennedy', 'Novo Mundo', 'Vila Izabel', 'Bom Retiro', 'Major Heitor', 'Augusta'],
      pins: ['botanico'],
    },
  ];

  const STOP_PIN = {
    'Tubo Rodoferroviária': 'rodo',
    'Tubo Praça Rui Barbosa': 'praca',
    'Tubo Centro Cívico': 'civico',
    'Tubo Jardim Botânico': 'botanico',
  };

  let stops = [];
  let activeRegionId = 'centro';
  let catalog = [];

  function kindLabel(entry) {
    if (entry.type === 'region') return 'Região';
    if (entry.stop?.kind === 'estacao') return 'Estação';
    if (entry.stop?.kind === 'terminal') return 'Terminal';
    return 'Tubo';
  }

  function regionForDistrict(district) {
    const match = OPS_REGIONS.find((region) => region.districts.includes(district));
    return match?.id || 'centro';
  }

  function buildCatalog(stopList) {
    const entries = OPS_REGIONS.map((region) => ({
      type: 'region',
      id: `region-${region.id}`,
      name: region.name,
      meta: region.summary,
      regionId: region.id,
    }));
    stopList.forEach((stop) => {
      entries.push({
        type: 'stop',
        id: stop.id,
        name: stop.name,
        meta: [stop.district, stop.address].filter(Boolean).join(' · '),
        stop,
        regionId: regionForDistrict(stop.district),
      });
    });
    return entries;
  }

  function setFilterLabel(text) {
    if (labelEl) labelEl.textContent = text;
  }

  function clearPinFocus() {
    mapArt.querySelectorAll('.gmap-pin-label').forEach((pin) => {
      pin.classList.remove('is-map-focus');
      pin.querySelector('.gmap-card')?.classList.remove('is-open');
    });
  }

  function applyRegion(regionId) {
    activeRegionId = regionId;
    mapArt.dataset.region = regionId;
    clearPinFocus();
    const region = OPS_REGIONS.find((item) => item.id === regionId) || OPS_REGIONS[0];
    mapArt.querySelectorAll('.gmap-pin-label').forEach((pin) => {
      const key = [...pin.classList].find((cls) => cls.startsWith('label-'))?.replace('label-', '');
      const visible = regionId === 'centro' || (key && region.pins.includes(key));
      pin.style.display = visible ? '' : 'none';
    });
  }

  function focusStopOnMap(stop) {
    clearPinFocus();
    const pinKey = STOP_PIN[stop.name];
    if (!pinKey) return;
    applyRegion('centro');
    const pin = mapArt.querySelector(`.label-${pinKey}`);
    if (!pin) return;
    pin.style.display = '';
    pin.classList.add('is-map-focus');
    pin.querySelector('.gmap-card')?.classList.add('is-open');
  }

  function setOpsMapHint(message) {
    const hint = document.getElementById('ops-map-hint');
    if (!hint) return;
    if (!message) {
      hint.hidden = true;
      hint.textContent = '';
      return;
    }
    hint.hidden = false;
    hint.textContent = message;
  }

  function updateUserLocationBadge(label) {
    const userPin = document.getElementById('map-user-pin');
    const labelNode = userPin?.querySelector('[data-map-user-label]');
    if (!userPin || !labelNode) return;
    userPin.hidden = false;
    userPin.setAttribute('aria-hidden', 'false');
    labelNode.textContent = label;
    mapArt.classList.add('has-user-location');
  }

  function applyUserLocation(position) {
    const catalogStops = stops.length ? stops : window.__buzzuTransitStops || [];
    const nearest = findNearestTransitStop(position.lat, position.lon, catalogStops);
    const locationButton = document.getElementById('ops-map-use-location');

    if (nearest) {
      const regionId = regionForDistrict(nearest.stop.district);
      applyRegion(regionId);
      setFilterLabel(nearest.stop.name);
      focusStopOnMap(nearest.stop);
      window.setBuzzuDepartureFilter?.({
        regionId,
        stop: nearest.stop,
        label: nearest.stop.name,
      });
      const distanceText =
        nearest.distanceKm < 1
          ? `${Math.round(nearest.distanceKm * 1000)} m`
          : `${nearest.distanceKm.toFixed(1)} km`;
      updateUserLocationBadge(nearest.stop.name);
      setOpsMapHint(`Você está a cerca de ${distanceText} de ${nearest.stop.name}.`);
    } else {
      setFilterLabel('Perto de você');
      window.setBuzzuDepartureFilter?.({
        stop: { name: position.label, district: '' },
        label: position.label,
      });
      updateUserLocationBadge('Você');
      setOpsMapHint('Localização ativa. Escolha um tubo no mapa se quiser refinar.');
    }

    if (locationButton) {
      locationButton.classList.add('is-active');
      locationButton.textContent = 'Localização ativa';
      locationButton.disabled = false;
    }
  }

  async function activateOpsMapLocation() {
    const locationButton = document.getElementById('ops-map-use-location');
    setOpsMapHint('Solicitando permissão de localização...');
    if (locationButton) {
      locationButton.disabled = true;
      locationButton.textContent = 'Localizando...';
    }
    try {
      const position = await requestPassengerPosition();
      applyUserLocation(position);
      closePanel();
    } catch (error) {
      mapArt.classList.remove('has-user-location');
      document.getElementById('map-user-pin')?.setAttribute('hidden', '');
      if (error?.code === 'UNSUPPORTED') {
        setOpsMapHint('Seu navegador não oferece localização automática.');
      } else if (error?.code === error.PERMISSION_DENIED) {
        setOpsMapHint('Permita o acesso à localização no navegador para usar esta opção.');
      } else {
        setOpsMapHint('Não foi possível obter sua localização. Tente novamente.');
      }
      if (locationButton) {
        locationButton.classList.remove('is-active');
        locationButton.textContent = 'Minha localização';
      }
    } finally {
      if (locationButton) locationButton.disabled = false;
    }
  }

  function appendLocationListOption(list, filterText) {
    const normalized = filterText.trim().toLowerCase();
    const showLocation =
      !normalized ||
      /local|minha|você|voce|gps|perto/.test(normalized);
    if (!showLocation) return;

    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tubo-picker-option tubo-picker-option-location';
    button.setAttribute('role', 'option');

    const name = document.createElement('span');
    name.className = 'tubo-picker-option-name';
    name.textContent = 'Minha localização';

    const meta = document.createElement('span');
    meta.className = 'tubo-picker-option-meta';
    const kind = document.createElement('span');
    kind.className = 'tubo-picker-option-kind is-region';
    kind.textContent = 'GPS';
    meta.append(kind, document.createTextNode('Tubo mais próximo e horários no visor'));

    button.append(name, meta);
    button.addEventListener('click', () => {
      activateOpsMapLocation();
    });
    item.appendChild(button);
    list.appendChild(item);
  }

  function closePanel() {
    panel.hidden = true;
    modal.hidden = true;
    document.body.classList.remove('tubo-picker-modal-open');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
  }

  function openPanel() {
    const tuboModal = document.getElementById('tubo-picker-modal');
    if (tuboModal && !tuboModal.hidden) {
      tuboModal.hidden = true;
      document.getElementById('tubo-picker-panel')?.setAttribute('hidden', '');
      document.getElementById('tubo-picker-open')?.setAttribute('aria-expanded', 'false');
    }
    modal.hidden = false;
    panel.hidden = false;
    document.body.classList.add('tubo-picker-modal-open');
    trigger.setAttribute('aria-expanded', 'true');
    const filter = document.getElementById('ops-map-region-filter');
    if (filter) filter.value = '';
    renderList();
    filter?.focus();
  }

  function renderList(filter = '') {
    const list = document.getElementById('ops-map-region-list');
    if (!list) return;
    const normalized = filter.trim().toLowerCase();
    const matches = catalog.filter((entry) =>
      `${entry.name} ${entry.meta} ${entry.type}`.toLowerCase().includes(normalized)
    );

    list.innerHTML = '';
    appendLocationListOption(list, filter);

    if (!matches.length) {
      const empty = document.createElement('li');
      empty.className = 'tubo-picker-empty';
      empty.textContent = normalized ? `Nenhum resultado para "${filter.trim()}".` : 'Nenhum ponto disponível.';
      list.appendChild(empty);
      return;
    }

    matches.forEach((entry) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tubo-picker-option';
      button.setAttribute('role', 'option');

      const name = document.createElement('span');
      name.className = 'tubo-picker-option-name';
      name.textContent = entry.name;

      const meta = document.createElement('span');
      meta.className = 'tubo-picker-option-meta';
      const kind = document.createElement('span');
      kind.className = `tubo-picker-option-kind${entry.type === 'region' ? ' is-region' : ''}`;
      kind.textContent = kindLabel(entry);
      meta.append(kind, document.createTextNode(entry.meta));

      button.append(name, meta);
      button.addEventListener('click', () => {
        if (entry.type === 'region') {
          applyRegion(entry.regionId);
          setFilterLabel(entry.name);
          window.setBuzzuDepartureFilter?.({
            regionId: entry.regionId,
            stop: null,
            label: entry.name,
          });
        } else {
          applyRegion(entry.regionId);
          setFilterLabel(entry.name);
          focusStopOnMap(entry.stop);
          window.setBuzzuDepartureFilter?.({
            regionId: entry.regionId,
            stop: entry.stop,
            label: entry.name,
          });
        }
        closePanel();
      });

      item.appendChild(button);
      list.appendChild(item);
    });
  }

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    if (modal.hidden) openPanel();
    else closePanel();
  });

  modal.querySelectorAll('[data-ops-map-close]').forEach((button) => {
    button.addEventListener('click', closePanel);
  });
  document.getElementById('ops-map-region-filter')?.addEventListener('input', (event) => {
    renderList(event.target.value);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closePanel();
  });

  document.getElementById('ops-map-use-location')?.addEventListener('click', () => {
    activateOpsMapLocation();
  });

  function hydrate(stopList) {
    stops = stopList;
    catalog = buildCatalog(stops);
    const foot = panel.querySelector('[data-ops-map-source]');
    if (foot) {
      foot.textContent = `${OPS_REGIONS.length} regiões · ${stops.length} pontos · mapa da operação URBS`;
    }
    applyRegion(activeRegionId);
    renderList();
  }

  window.addEventListener('buzzu:stops-loaded', (event) => {
    if (!catalog.length) hydrate(event.detail || []);
  });

  if (window.__buzzuTransitStops?.length) {
    hydrate(window.__buzzuTransitStops);
  } else {
    (async () => {
      for (const base of resolveApiBases()) {
        try {
          const response = await fetch(`${base}/transit/stops`);
          if (!response.ok) continue;
          const payload = await readJsonResponse(response);
          if (!catalog.length) hydrate(payload.stops || []);
          return;
        } catch {
          // tenta próxima base
        }
      }
      if (!catalog.length) hydrate([]);
    })();
  }
})();