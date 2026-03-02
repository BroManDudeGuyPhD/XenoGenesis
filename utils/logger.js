// Centralized logger utility with level control and optional global console patching
// Levels: silent < error < warn < info < debug
// Provides ANSI color tags for structured, emoji-lite console output.

const LEVELS = ["silent", "error", "warn", "info", "debug"]; 

// ─── ANSI Color Helpers ─────────────────────────────────────
// Usage:  console.log(c.grn('OK'), c.dim('details'))
const c = {
  // Reset
  reset:  (s) => `\x1b[0m${s}\x1b[0m`,
  // Styles
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
  italic: (s) => `\x1b[3m${s}\x1b[0m`,
  under:  (s) => `\x1b[4m${s}\x1b[0m`,
  // Foreground colors
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  grn:    (s) => `\x1b[32m${s}\x1b[0m`,
  yel:    (s) => `\x1b[33m${s}\x1b[0m`,
  blu:    (s) => `\x1b[34m${s}\x1b[0m`,
  mag:    (s) => `\x1b[35m${s}\x1b[0m`,
  cyn:    (s) => `\x1b[36m${s}\x1b[0m`,
  wht:    (s) => `\x1b[37m${s}\x1b[0m`,
  gry:    (s) => `\x1b[90m${s}\x1b[0m`,
  // Bright foreground
  bred:   (s) => `\x1b[91m${s}\x1b[0m`,
  bgrn:   (s) => `\x1b[92m${s}\x1b[0m`,
  byel:   (s) => `\x1b[93m${s}\x1b[0m`,
  bblu:   (s) => `\x1b[94m${s}\x1b[0m`,
  bmag:   (s) => `\x1b[95m${s}\x1b[0m`,
  bcyn:   (s) => `\x1b[96m${s}\x1b[0m`,
  // Background colors
  bgRed:  (s) => `\x1b[41m${s}\x1b[0m`,
  bgGrn:  (s) => `\x1b[42m${s}\x1b[0m`,
  bgYel:  (s) => `\x1b[43m${s}\x1b[0m`,
  bgBlu:  (s) => `\x1b[44m${s}\x1b[0m`,
  // Semantic shortcuts (maps to category → color)
  ok:     (s) => `\x1b[32m${s}\x1b[0m`,    // green
  err:    (s) => `\x1b[31m${s}\x1b[0m`,    // red
  warn:   (s) => `\x1b[33m${s}\x1b[0m`,    // yellow
  info:   (s) => `\x1b[36m${s}\x1b[0m`,    // cyan
  net:    (s) => `\x1b[34m${s}\x1b[0m`,    // blue — network/socket
  game:   (s) => `\x1b[35m${s}\x1b[0m`,    // magenta — game/experiment
  data:   (s) => `\x1b[94m${s}\x1b[0m`,    // bright blue — data/csv
  auth:   (s) => `\x1b[93m${s}\x1b[0m`,    // bright yellow — auth/session
  clean:  (s) => `\x1b[90m${s}\x1b[0m`,    // gray — cleanup/routine
  tag: function(label) {                     // [TAG] in color
    return `\x1b[90m[\x1b[0m${label}\x1b[90m]\x1b[0m`;
  }
};

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
  const levelColors = {
    debug: '\x1b[90m',   // gray
    info:  '\x1b[36m',   // cyan
    warn:  '\x1b[33m',   // yellow
    error: '\x1b[31m',   // red
  };
  const color = levelColors[level] || '\x1b[0m';
  return `\x1b[90m[${ts}]\x1b[0m ${color}[${level.toUpperCase()}]\x1b[0m`;
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
module.exports.c = c;
