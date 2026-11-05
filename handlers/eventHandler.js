/**
 * Event Handler
 * Dynamically loads and binds all event listeners from the events/ directory.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

function loadEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');

  if (!fs.existsSync(eventsPath)) {
    logger.warn('Events directory not found.');
    return;
  }

  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      const event = require(filePath);
      if (!event.name || typeof event.execute !== 'function') {
        logger.warn(`Skipping invalid event file: ${file} (missing name or execute function)`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }

      logger.info(`Registered event listener: ${event.name}`);
    } catch (error) {
      logger.error(`Error loading event file ${file}:`, error);
    }
  }
}

module.exports = {
  loadEvents
};
