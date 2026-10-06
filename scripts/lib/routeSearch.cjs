/** Mesmas regras de validação do formulário de rota (app.js). */
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

function pickRouteLines(catalog, seed = 0) {
  if (!catalog.length) return [];
  const offset = seed % catalog.length;
  return [catalog[offset], catalog[(offset + 7) % catalog.length], catalog[(offset + 13) % catalog.length]];
}

module.exports = { validateRouteSearch, pickRouteLines };
