// Centralized logger utility with level control and optional global console patching
// Levels: silent < error < warn < info < debug

const LEVELS = ["silent", "error", "warn", "info", "debug"]; 

function resolveLevelFromEnv() {
  const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
  // Back-compat: if DEBUG_LOGS=true, use 'debug'; else default to 'warn'
  if (env.DEBUG_LOGS === 'true') return 'debug';
  const lvl = (env.LOG_LEVEL || '').toLowerCase();
  return LEVELS.includes(lvl) ? lvl : 'warn';
}

let currentLevel = resolveLevelFromEnv();

function levelIndex(level) {
  return LEVELS.indexOf(level);
}

function shouldLog(level) {
  return levelIndex(level) <= levelIndex(currentLevel);
}

function stamp(level) {
  const ts = new Date().toISOString();
  return `[${ts}] [${level.toUpperCase()}]`;
}

const logger = {
  setLevel(level) {
    if (LEVELS.includes(level)) currentLevel = level;
  },
  getLevel() {
    return currentLevel;
  },
  debug(...args) {
    if (shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.debug ? console.debug(stamp('debug'), ...args) : console.log(stamp('debug'), ...args);
    }
  },
  info(...args) {
    if (shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.info ? console.info(stamp('info'), ...args) : console.log(stamp('info'), ...args);
    }
  },
  warn(...args) {
    if (shouldLog('warn')) {
      // eslint-disable-next-line no-console
      console.warn(stamp('warn'), ...args);
    }
  },
  error(...args) {
    if (shouldLog('error')) {
      // eslint-disable-next-line no-console
      console.error(stamp('error'), ...args);
    }
  },
  // Patch global console methods to respect level. We map console.log to 'debug' to
  // match prior behavior where .log was treated as noisy debug output.
  applyGlobalPatch(options = {}) {
    const mapConsoleLogTo = options.mapConsoleLogTo || 'debug';
    const original = {
      log: console.log.bind(console),
      info: console.info ? console.info.bind(console) : console.log.bind(console),
      debug: console.debug ? console.debug.bind(console) : console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console)
    };
    
    // eslint-disable-next-line no-console
    console.log = (...args) => {
      const lvl = mapConsoleLogTo;
      if (shouldLog(lvl)) original.log(stamp(lvl), ...args);
    };
    // eslint-disable-next-line no-console
    console.info = (...args) => {
      if (shouldLog('info')) original.info(stamp('info'), ...args);
    };
    // eslint-disable-next-line no-console
    console.debug = (...args) => {
      if (shouldLog('debug')) original.debug(stamp('debug'), ...args);
    };
    // eslint-disable-next-line no-console
    console.warn = (...args) => {
      if (shouldLog('warn')) original.warn(stamp('warn'), ...args);
    };
    // eslint-disable-next-line no-console
    console.error = (...args) => {
      if (shouldLog('error')) original.error(stamp('error'), ...args);
    };
  }
};

module.exports = logger;
