const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.info;
const FILE_LOGGING = process.env.LOG_FILE !== 'false';

let sink = null;
if (FILE_LOGGING) {
  sink = require('./fileSink');
}

function formatMessage(level, message, data) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}]`;
  if (data) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }
  return `${prefix} ${message}`;
}

function emit(level, msg, data) {
  const line = formatMessage(level, msg, data);
  if (level === 'debug') console.debug(line);
  else if (level === 'warn') console.warn(line);
  else if (level === 'error') console.error(line);
  else console.log(line);
  if (sink && CURRENT_LEVEL <= LOG_LEVELS[level]) {
    sink.write(formatMessage(level, msg, data));
  }
}

module.exports = {
  debug: (msg, data) => { if (CURRENT_LEVEL <= LOG_LEVELS.debug) emit('debug', msg, data); },
  info: (msg, data) => { if (CURRENT_LEVEL <= LOG_LEVELS.info) emit('info', msg, data); },
  warn: (msg, data) => { if (CURRENT_LEVEL <= LOG_LEVELS.warn) emit('warn', msg, data); },
  error: (msg, data) => { if (CURRENT_LEVEL <= LOG_LEVELS.error) emit('error', msg, data); },
};
