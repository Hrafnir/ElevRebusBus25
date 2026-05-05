const fs = require('fs');
const path = require('path');
const { createSeedData } = require('../../storage/seed');

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'rebus-platform.json');

function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(createSeedData(), null, 2));
  }
}

function readDatabase() {
  ensureDatabase();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDatabase(data) {
  ensureDatabase();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function updateDatabase(mutator) {
  const data = readDatabase();
  const result = mutator(data);
  writeDatabase(data);
  return result;
}

module.exports = {
  readDatabase,
  writeDatabase,
  updateDatabase
};
