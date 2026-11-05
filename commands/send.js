/**
 * /send Command
 *
 * Core feature: Sends a message to the current interaction channel or a specified channel.
 * Configured strictly for USER_INSTALL across Guild, BotDM, and PrivateChannel contexts.
 */

const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  ChannelType
} = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('send')
    .setDescription('Send a message using your personal user-installed application')
    // STRICT REQUIREMENT: User Install only, NO Guild Install
    .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
    // Interaction contexts: Servers, Bot DMs, and Group DMs / Private Channels
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('The message content to send')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Destination channel (optional; defaults to the current channel)')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.PublicThread,
          ChannelType.PrivateThread
        )
        .setRequired(false)
    ),

  /**
   * Executes the /send slash command.
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const rawMessage = interaction.options.getString('message', true);
    const message = rawMessage.trim();
    const channelOption = interaction.options.getChannel('channel');

    if (!message || message.length === 0) {
      return interaction.reply({
        content: '❌ **Error**: Message content cannot be empty or only whitespace.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (message.length > 2000) {
      return interaction.reply({
        content: `❌ **Error**: Message exceeds Discord's 2000-character limit (${message.length} characters).`,
        flags: MessageFlags.Ephemeral
      });
    }

    // CASE 1: A specific destination channel was selected that differs from current channel
    if (channelOption && channelOption.id !== interaction.channelId) {
      try {
        const targetChannel = await interaction.client.channels.fetch(channelOption.id).catch(() => null);

        if (!targetChannel || !targetChannel.isTextBased() || typeof targetChannel.send !== 'function') {
          return interaction.reply({
            content: `❌ **Delivery Failed**: Cannot access or send messages to <#${channelOption.id}>.\n*Note: To deliver messages to a different channel, the bot application must be a member of that guild with the Send Messages permission.*`,
            flags: MessageFlags.Ephemeral
          });
        }

        await targetChannel.send({ content: message });

        return interaction.reply({
          content: `✅ **Success**: Message sent to <#${targetChannel.id}>.`,
          flags: MessageFlags.Ephemeral
        });
      } catch (error) {
        logger.error(`Failed to send message to channel ${channelOption.id}:`, error);
        return interaction.reply({
          content: `❌ **Failed to send message**: ${error.message}`,
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // CASE 2: No specific channel was chosen (or current channel was chosen)
    // This is the core User-Install experience where the app can be used anywhere.
    try {
      let sentViaChannel = false;

      // First attempt: Check if the bot can send a direct standalone channel message
      // (This succeeds if the bot is present in the server or in direct channel contexts)
      if (interaction.channel && typeof interaction.channel.send === 'function') {
        try {
          await interaction.channel.send({ content: message });
          sentViaChannel = true;
        } catch {
          // If the bot lacks traditional channel access (standard for user-installed apps in external servers),
          // fallback to Discord interaction response flow.
          sentViaChannel = false;
        }
      }

      if (sentViaChannel) {
        // Sent as normal message; provide ephemeral confirmation to the user
        return await interaction.reply({
          content: '✅ **Success**: Message sent successfully.',
          flags: MessageFlags.Ephemeral
        });
      }

      // Second attempt: Send message via interaction response
      // This works in any server/DM where Discord user-install interactions are supported!
      await interaction.reply({ content: message });

      // Provide ephemeral confirmation to the authorized user
      await interaction.followUp({
        content: '✅ **Success**: Message sent successfully via application interaction.',
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      logger.error('Failed to send message in current interaction context:', error);

      const errorMessage = {
        content: `❌ **Failed to send message**: ${error.message}`,
        flags: MessageFlags.Ephemeral
      };

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(errorMessage).catch(() => {});
      } else {
        await interaction.followUp(errorMessage).catch(() => {});
      }
    }
  }
};
