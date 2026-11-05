/**
 * Application Logger
 * Provides structured, timestamped console logging with log levels.
 */

const LOG_LEVELS = {
  INFO: '\x1b[36m[INFO]\x1b[0m',
  SUCCESS: '\x1b[32m[SUCCESS]\x1b[0m',
  WARN: '\x1b[33m[WARN]\x1b[0m',
  ERROR: '\x1b[31m[ERROR]\x1b[0m',
  SECURITY: '\x1b[35m[SECURITY]\x1b[0m'
};

function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

const logger = {
  info: (message, ...args) => {
    console.log(`[${getTimestamp()}] ${LOG_LEVELS.INFO} ${message}`, ...args);
  },
  success: (message, ...args) => {
    console.log(`[${getTimestamp()}] ${LOG_LEVELS.SUCCESS} ${message}`, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`[${getTimestamp()}] ${LOG_LEVELS.WARN} ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`[${getTimestamp()}] ${LOG_LEVELS.ERROR} ${message}`, ...args);
  },
  security: (message, ...args) => {
    console.warn(`[${getTimestamp()}] ${LOG_LEVELS.SECURITY} ${message}`, ...args);
  }
};

module.exports = logger;
