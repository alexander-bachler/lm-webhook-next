/**
 * Centralized data directory paths for VPS/Docker deployments.
 * Set DATA_DIR to persist devices and SQLite on a mounted volume (e.g. /app/data).
 */
const fs = require('fs');
const path = require('path');

function getDataDir() {
  const dir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Path: DATA_DIR/devices.json
 * One-time copy from legacy ./devices.json (project root) if the preferred file does not exist.
 */
function getDevicesFilePath() {
  const preferred = path.join(getDataDir(), 'devices.json');
  const legacy = path.join(process.cwd(), 'devices.json');
  if (!fs.existsSync(preferred) && fs.existsSync(legacy)) {
    try {
      fs.copyFileSync(legacy, preferred);
    } catch (e) {
      console.warn('[data-paths] Could not migrate devices.json to DATA_DIR:', e.message);
    }
  }
  return preferred;
}

function getDecodersDir() {
  return path.join(getDataDir(), 'decoders');
}

function getWebhookDbPath() {
  return path.join(getDataDir(), 'webhooks.sqlite');
}

module.exports = {
  getDataDir,
  getDevicesFilePath,
  getDecodersDir,
  getWebhookDbPath,
};
