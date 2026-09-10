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

const signupForm = document.querySelector('#signup-form');
if (signupForm && !signupForm.querySelector('[name="password"]')) {
  const passwordLabel = document.createElement('label');
  passwordLabel.innerHTML = 'Crie uma senha<input required type="password" name="password" minlength="8" placeholder="Mínimo de 8 caracteres">';
  signupForm.querySelector('.form-row')?.before(passwordLabel);
}

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

document.querySelector('#signup-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.querySelector('.form-message');
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
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