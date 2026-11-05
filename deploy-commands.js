/**
 * Command Deployment Script
 *
 * Deploys slash commands globally using Discord REST API.
 * For Discord User-Installed Apps, commands MUST be deployed globally via Routes.applicationCommands(clientId).
 */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');

async function deployCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if (command.data && typeof command.data.toJSON === 'function') {
      const json = command.data.toJSON();
      commands.push(json);
      logger.info(
        `Prepared command: /${json.name} (IntegrationTypes: ${JSON.stringify(json.integration_types)}, Contexts: ${JSON.stringify(json.contexts)})`
      );
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    logger.info(`Starting deployment of ${commands.length} application command(s) globally...`);

    const data = await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands }
    );

    logger.success(`Successfully deployed ${data.length} global slash command(s) for User Install!`);
    logger.info('Please note: Global command updates may take a few moments to propagate across Discord clients.');
  } catch (error) {
    logger.error('Failed to deploy application commands:', error);
    process.exit(1);
  }
}

deployCommands();
