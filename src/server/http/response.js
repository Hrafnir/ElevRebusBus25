function json(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  json(res, 404, { error: 'Ikke funnet.' });
}

function badRequest(res, message = 'Ugyldig foresporsel.') {
  json(res, 400, { error: message });
}

function unauthorized(res) {
  json(res, 401, { error: 'Ikke innlogget.' });
}

function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error('For stor foresporsel.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

module.exports = {
  json,
  notFound,
  badRequest,
  unauthorized,
  parseJson
};
