const { handleRequest } = require('../src/server/server');

function createHandler(apiPath) {
  return async function vercelApiHandler(req, res) {
    try {
      const query = req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      req.url = `${apiPath}${query}`;
      await handleRequest(req, res);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ error: 'Erro interno do servidor.' }));
      }
    }
  };
}

module.exports = { createHandler };
