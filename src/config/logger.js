const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = LEVELS[process.env.LOG_LEVEL] !== undefined ? LEVELS[process.env.LOG_LEVEL] : LEVELS.info;

function formatMessage(level, message, meta) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  return JSON.stringify(entry);
}

const logger = {
  error(message, meta) {
    if (CURRENT_LEVEL >= LEVELS.error) console.error(formatMessage('error', message, meta));
  },
  warn(message, meta) {
    if (CURRENT_LEVEL >= LEVELS.warn) console.warn(formatMessage('warn', message, meta));
  },
  info(message, meta) {
    if (CURRENT_LEVEL >= LEVELS.info) console.log(formatMessage('info', message, meta));
  },
  debug(message, meta) {
    if (CURRENT_LEVEL >= LEVELS.debug) console.log(formatMessage('debug', message, meta));
  },
};

module.exports = logger;
