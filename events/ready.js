/**
 * Ready Event Handler
 * Triggered once when the Discord client establishes connection.
 */

const { Events } = require('discord.js');
const logger = require('../utils/logger');
const config = require('../config');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.success(`Personal User-Install Bot connected as ${client.user.tag} (ID: ${client.user.id})`);
    logger.info(`Configured Owner Discord ID: ${config.ownerId}`);
    logger.info('Integration Type: USER_INSTALL only (usable across servers & contexts without bot invites).');
  }
};
