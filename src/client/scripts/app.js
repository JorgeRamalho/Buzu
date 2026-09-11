const searchDrawer = document.querySelector('[data-search-drawer]');
const searchToggle = document.querySelector('[data-search-toggle]');
const searchClose = document.querySelector('[data-search-close]');
const globalSearch = document.querySelector('#global-search');
const routeInputs = document.querySelectorAll('.route-field input');
const API = '/api';

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
  if (event.target.value !== 'Minha localização atual') {
    originCoordinates = '';
    delete event.target.dataset.coordinates;
  }
}

originInput?.addEventListener('input', clearStoredOrigin);

function setRouteNote(message) {
  const note = document.querySelector('.route-note');
  if (note) note.innerHTML = `<span>✦</span> ${message}`;
}

function usePassengerLocation() {
  originCoordinates = '';
  if (originInput) delete originInput.dataset.coordinates;
  if (!navigator.geolocation) {
    setRouteNote('Seu navegador não oferece localização automática. Digite o ponto de partida.');
    return;
  }
  setRouteNote('Solicitando sua localização atual...');
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      originCoordinates = `${coords.latitude},${coords.longitude}`;
      originInput.value = 'Minha localização atual';
      originInput.dataset.coordinates = originCoordinates;
      setRouteNote('Origem definida pela localização do passageiro.');
    },
    () => setRouteNote('Não foi possível acessar sua localização. Digite o ponto de partida.'),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

if (originInput) {
  const locationButton = document.createElement('button');
  locationButton.type = 'button';
  locationButton.className = 'location-button';
  locationButton.textContent = 'Usar minha localização';
  locationButton.setAttribute('aria-label', 'Usar minha localização como origem');
  locationButton.addEventListener('click', usePassengerLocation);
  const routeSearch = document.querySelector('.route-search');
  const routeNote = document.querySelector('.route-note');
  routeSearch?.parentElement?.insertBefore(locationButton, routeNote || null);
}

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
    const arrivals = data.arrivals || [];
    const status = document.querySelector('.status-live strong');
    const updated = document.querySelector('.status-live span');
    if (status) status.textContent = data.operation === 'normal' ? 'Operação normal' : 'Atenção na operação';
    if (updated) updated.textContent = data.source === 'urbs' ? 'URBS · atualizado agora' : 'Modo demonstração';
    const items = document.querySelectorAll('.departure-item');
    arrivals.slice(0, items.length).forEach((arrival, index) => {
      const item = items[index];
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

// --- Scroll contínuo de chegadas: todas as linhas de Curitiba ---
(function initDepartureScroll() {
  const track = document.getElementById('departure-track');
  if (!track) return;

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

  // Gera tempos aleatórios entre 1 e 30 min
  function buildItems() {
    return LINES.map(line => ({
      ...line,
      minutes: Math.floor(Math.random() * 30) + 1
    })).sort((a, b) => a.minutes - b.minutes);
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
    track.innerHTML = '';

    // Conjunto original
    items.forEach(item => track.appendChild(renderItem(item)));
    // Cópia duplicada para o loop sem corte
    items.forEach(item => track.appendChild(renderItem(item, true)));

    // Altura de metade do track = altura de um conjunto
    requestAnimationFrame(() => {
      const half = track.scrollHeight / 2;
      // duração proporcional: ~2.2s por item
      const dur = Math.round(items.length * 2.2);
      track.style.setProperty('--scroll-dur', `${dur}s`);
      track.style.setProperty('--scroll-half', `${half}px`);
      track.classList.add('is-running');
    });
  }

  populate();
  // Atualiza os tempos a cada 60 s mantendo o scroll
  setInterval(() => {
    track.classList.remove('is-running');
    populate();
  }, 60000);
})();

// Autocomplete do formulário

searchToggle?.addEventListener('click', () => {
  searchDrawer.classList.add('is-open');
  searchResults.hidden = false;
  renderSearchResults(globalSearch?.value || '');
  globalSearch?.focus();
});
searchClose?.addEventListener('click', () => { searchDrawer.classList.remove('is-open'); searchResults.hidden = true; });

document.querySelector('[data-route-search]')?.addEventListener('click', () => {
  const from = originInput?.value.trim() || '';
  const to = destinationInput?.value.trim() || '';
  const button = document.querySelector('[data-route-search]');
  if (!from || !to) {
    setRouteNote('Informe origem e destino para abrir sua rota no Google Maps.');
    return;
  }
  if (from.toLocaleLowerCase() === to.toLocaleLowerCase()) {
    setRouteNote('Escolha pontos diferentes para calcular sua rota.');
    return;
  }
  if (from.length < 3 || to.length < 3) {
    setRouteNote('Digite uma origem e um destino mais completos.');
    return;
  }
  const origin = originCoordinates && from === 'Minha localização atual' ? originCoordinates : from;
  const mapsUrl = new URL('https://www.google.com/maps/dir/');
  mapsUrl.searchParams.set('api', '1');
  mapsUrl.searchParams.set('origin', origin);
  mapsUrl.searchParams.set('destination', to);
  mapsUrl.searchParams.set('travelmode', 'transit');
  mapsUrl.searchParams.set('hl', 'pt-BR');
  const mapsWindow = window.open(mapsUrl.toString(), '_blank', 'noopener,noreferrer');
  if (!mapsWindow) {
    setRouteNote('O navegador bloqueou a abertura do Google Maps. Permita pop-ups para continuar.');
    return;
  }
  button.innerHTML = 'Abrindo Google Maps <span>↗</span>';
  button.style.background = '#2f9466';
  setTimeout(() => {
    button.innerHTML = 'Encontrar rota <span>→</span>';
    button.style.background = '';
  }, 3200);
  setRouteNote(`Rota preparada de ${from} para ${to}. Confirme as opções de transporte público no Google Maps.`);
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
  if (event.key === 'Enter') document.querySelector('[data-route-search]')?.click();
}));