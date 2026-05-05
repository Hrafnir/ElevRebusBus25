const fs = require('fs');
const path = require('path');

loadDotEnv();

const config = {
  port: Number(process.env.PORT || 3000),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  allowDevAuth: process.env.ALLOW_DEV_AUTH !== 'false',
  uploadMaxBytes: Number(process.env.UPLOAD_MAX_BYTES || 100 * 1024 * 1024)
};

function loadDotEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

module.exports = { config };
