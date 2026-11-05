/**
 * Database Layer Entrypoint
 */

const authRepository = require('./authRepository');
const logger = require('../utils/logger');

async function initDatabase() {
  try {
    await authRepository.init();
    logger.info('Database initialized successfully.');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

module.exports = {
  initDatabase,
  authRepository
};
