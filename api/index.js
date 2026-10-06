const { handleRequest } = require('../src/server/server');

module.exports = async (req, res) => {
  try {
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
