const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || path.resolve(__dirname, '..', '..', 'logs');
const MAX_FILE_SIZE = parseInt(process.env.LOG_MAX_SIZE_BYTES, 10) || 5 * 1024 * 1024;
const MAX_FILES = parseInt(process.env.LOG_MAX_FILES, 10) || 5;

function rotateIfNeeded(filePath) {
  try {
    const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    if (!stat || stat.size < MAX_FILE_SIZE) return;
    for (let i = MAX_FILES - 1; i >= 1; i--) {
      const from = `${filePath}.${i}`;
      const to = `${filePath}.${i + 1}`;
      if (fs.existsSync(from)) fs.renameSync(from, to);
    }
    fs.renameSync(filePath, `${filePath}.1`);
  } catch {
    // rotation is best-effort; never break logging
  }
}

function write(line) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const filePath = path.join(LOG_DIR, 'backend.log');
    rotateIfNeeded(filePath);
    fs.appendFileSync(filePath, line + '\n', 'utf8');
  } catch {
    // file logging must never crash the process
  }
}

module.exports = { write };
