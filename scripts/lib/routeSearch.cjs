/** Mesmas regras de validação do formulário de rota (app.js). */
const MIN_ROUTE_FIELD_CHARS = 2;

function validateRouteSearch({ from, to, hasOriginCoords }) {
  const origin = String(from || '').trim();
  const destination = String(to || '').trim();

  if ((!origin && !hasOriginCoords) || !destination) {
    return 'Informe origem e destino para calcular sua rota.';
  }
  if (origin && destination && origin.toLocaleLowerCase('pt-BR') === destination.toLocaleLowerCase('pt-BR')) {
    return 'Escolha pontos diferentes para calcular sua rota.';
  }
  if ((!origin || origin.length < MIN_ROUTE_FIELD_CHARS) && !hasOriginCoords) {
    return 'Digite a origem com pelo menos 2 caracteres.';
  }
  if (destination.length < MIN_ROUTE_FIELD_CHARS) {
    return 'Digite o destino com pelo menos 2 caracteres.';
  }
  return null;
}

function pickRouteLines(catalog, seed = 0) {
  if (!catalog.length) return [];
  const offset = seed % catalog.length;
  return [catalog[offset], catalog[(offset + 7) % catalog.length], catalog[(offset + 13) % catalog.length]];
}

module.exports = { validateRouteSearch, pickRouteLines };
