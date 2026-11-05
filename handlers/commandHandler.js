/**
 * Command Handler
 * Dynamically loads all commands from the commands/ directory into the client.
 */

const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const logger = require('../utils/logger');

function loadCommands(client) {
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, '..', 'commands');

  if (!fs.existsSync(commandsPath)) {
    logger.warn('Commands directory not found.');
    return;
  }

  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath);
      if (command.data && command.data.name && typeof command.execute === 'function') {
        client.commands.set(command.data.name, command);
        logger.info(`Loaded command: /${command.data.name}`);
      } else {
        logger.warn(`Skipping invalid command file: ${file} (missing data.name or execute function)`);
      }
    } catch (error) {
      logger.error(`Error loading command file ${file}:`, error);
    }
  }

  logger.info(`Total commands loaded: ${client.commands.size}`);
}

module.exports = {
  loadCommands
};
