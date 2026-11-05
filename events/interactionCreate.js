/**
 * InteractionCreate Event Handler
 *
 * Implements strict authorization middleware before any command can be executed.
 * Ensures that ONLY the owner or explicitly authorized Discord User IDs can run commands.
 */

const { Events, MessageFlags } = require('discord.js');
const { authRepository } = require('../database');
const logger = require('../utils/logger');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    // Only handle slash commands
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`No handler found for command /${interaction.commandName}`);
      return;
    }

    const userId = interaction.user.id;
    const userTag = interaction.user.tag || interaction.user.username;

    // ==========================================
    // SECURITY LAYER: STRICT AUTHORIZATION CHECK
    // ==========================================
    const authorized = await authRepository.isAuthorized(userId);

    if (!authorized) {
      logger.security(
        `UNAUTHORIZED COMMAND ATTEMPT: User "${userTag}" (ID: ${userId}) attempted to execute /${interaction.commandName} in context ${interaction.context}`
      );

      return interaction.reply({
        content: '🚫 **Access Denied**: You are not authorized to execute commands on this private application.',
        flags: MessageFlags.Ephemeral
      });
    }

    // ==========================================
    // EXECUTE AUTHORIZED COMMAND
    // ==========================================
    try {
      logger.info(
        `Executing /${interaction.commandName} for authorized user "${userTag}" (${userId}) [Context: ${interaction.context}]`
      );
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error during execution of /${interaction.commandName}:`, error);

      const errorMessage = {
        content: '❌ **Execution Error**: An unexpected error occurred while executing this command.',
        flags: MessageFlags.Ephemeral
      };

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      } catch (replyErr) {
        logger.error('Failed to send error response to user:', replyErr);
      }
    }
  }
};
