const http = require('http');
const { handleApi } = require('./http/routes');
const { serveStatic, serveUpload } = require('./http/staticFiles');
const { json } = require('./http/response');
const { config } = require('./config');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const handled = await handleApi(req, res, url);
      if (!handled) json(res, 404, { error: 'Ukjent API-endepunkt.' });
      return;
    }
    if (url.pathname.startsWith('/uploads/')) {
      serveUpload(req, res, url);
      return;
    }
    serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    json(res, 500, { error: 'Serverfeil.' });
  }
});

server.listen(config.port, () => {
  console.log(`Rebus Platform kjører på http://localhost:${config.port}`);
  console.log(`Admin: http://localhost:${config.port}/admin`);
  console.log(`Elev: http://localhost:${config.port}/student`);
  console.log(`Google-login: ${config.googleClientId ? 'konfigurert' : 'dev-fallback'}`);
  console.log(`Google Maps: ${config.googleMapsApiKey ? 'konfigurert' : 'manuell fallback'}`);
});
