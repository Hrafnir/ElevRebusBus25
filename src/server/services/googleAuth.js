const https = require('https');
const { config } = require('../config');

function verifyGoogleIdToken(idToken) {
  if (!config.googleClientId) {
    return Promise.reject(new Error('GOOGLE_CLIENT_ID mangler.'));
  }

  return new Promise((resolve, reject) => {
    const tokenPath = `/oauth2/v3/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    const request = https.get({
      hostname: 'oauth2.googleapis.com',
      path: tokenPath,
      method: 'GET',
      timeout: 8000
    }, response => {
      let body = '';
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          const payload = JSON.parse(body);
          if (response.statusCode !== 200) {
            reject(new Error(payload.error_description || 'Google token kunne ikke verifiseres.'));
            return;
          }
          if (payload.aud !== config.googleClientId) {
            reject(new Error('Google token har feil audience.'));
            return;
          }
          if (!payload.email_verified || payload.email_verified === 'false') {
            reject(new Error('Google-kontoen mangler verifisert e-post.'));
            return;
          }
          resolve({
            email: payload.email,
            name: payload.name || payload.email,
            picture: payload.picture || null,
            googleSubject: payload.sub
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Google-verifisering tok for lang tid.'));
    });
    request.on('error', reject);
  });
}

module.exports = { verifyGoogleIdToken };
