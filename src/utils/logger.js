const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.info;

function formatMessage(level, message, data) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}]`;
  if (data) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }
  return `${prefix} ${message}`;
}

module.exports = {
  debug: (msg, data) => { if (CURRENT_LEVEL <= LOG_LEVELS.debug) console.debug(formatMessage('debug', msg, data)); },
  info: (msg, data) => { if (CURRENT_LEVEL <= LOG_LEVELS.info) console.log(formatMessage('info', msg, data)); },
  warn: (msg, data) => { if (CURRENT_LEVEL <= LOG_LEVELS.warn) console.warn(formatMessage('warn', msg, data)); },
  error: (msg, data) => { if (CURRENT_LEVEL <= LOG_LEVELS.error) console.error(formatMessage('error', msg, data)); },
};
