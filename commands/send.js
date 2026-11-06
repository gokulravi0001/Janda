/**
 * /send Command
 *
 * Core feature: Sends a message to the current interaction channel or a specified channel.
 * Options:
 *   - message (required string): Message content to send
 *   - count (optional integer): Number of times to send the message (1 - 1000, default 1)
 *   - channel (optional channel): Destination channel
 * Configured strictly for USER_INSTALL across Guild, BotDM, and PrivateChannel contexts.
 */

const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');
const logger = require('../utils/logger');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends messages sequentially via channel.send with automated rate-limit retry.
 */
async function sendMessagesViaChannel(channel, message, count) {
  let sentCount = 0;

  while (sentCount < count) {
    if (sentCount > 0) {
      await sleep(800); // 800ms base pacing
    }

    try {
      await channel.send({ content: message });
      sentCount++;
    } catch (err) {
      logger.warn(`Channel.send attempt failed on ${sentCount + 1}/${count}: ${err.message}`);

      // Handle Discord rate limits (429) by waiting and retrying instead of giving up
      const isRateLimit = err.status === 429 || (err.message && err.message.toLowerCase().includes('rate limit'));
      if (isRateLimit || err.retryAfter) {
        const waitMs = err.retryAfter
          ? (typeof err.retryAfter === 'number' && err.retryAfter < 100 ? err.retryAfter * 1000 : err.retryAfter) + 300
          : 2000;
        logger.info(`Channel rate limit encountered. Pausing for ${waitMs}ms before retrying message ${sentCount + 1}...`);
        await sleep(waitMs);
        continue;
      }

      // For transient errors, wait and retry once
      await sleep(1500);
      try {
        await channel.send({ content: message });
        sentCount++;
      } catch (fatalErr) {
        logger.error(`Unrecoverable error on message ${sentCount + 1}/${count}:`, fatalErr.message);
        break;
      }
    }
  }

  return sentCount;
}

/**
 * Sends messages sequentially via interaction response & followUps with automated rate-limit retry.
 */
async function sendMessagesViaInteraction(interaction, message, count) {
  // 1. First message is sent immediately via the interaction reply (<50ms)
  await interaction.reply({ content: message });
  let sentCount = 1;

  // 2. Subsequent messages are sent using interaction followUp webhooks
  while (sentCount < count) {
    await sleep(800); // 800ms base pacing to respect webhook limits

    try {
      await interaction.followUp({ content: message });
      sentCount++;
    } catch (err) {
      logger.warn(`FollowUp attempt failed on ${sentCount + 1}/${count}: ${err.message}`);

      // If the interaction token expired (15-minute Discord limit)
      if (err.code === 10062 || (err.message && err.message.includes('Unknown interaction'))) {
        logger.error('Interaction token expired (15-minute Discord limit reached). Stopping loop.');
        break;
      }

      // Handle Discord rate limits (429) by waiting and retrying instead of breaking!
      const isRateLimit = err.status === 429 || (err.message && err.message.toLowerCase().includes('rate limit'));
      if (isRateLimit || err.retryAfter) {
        const waitMs = err.retryAfter
          ? (typeof err.retryAfter === 'number' && err.retryAfter < 100 ? err.retryAfter * 1000 : err.retryAfter) + 300
          : 2000;
        logger.info(`Interaction webhook rate limit hit. Pausing for ${waitMs}ms before retrying message ${sentCount + 1}...`);
        await sleep(waitMs);
        continue; // Retry sending this message!
      }

      // For other transient errors, wait and retry once
      await sleep(1500);
      try {
        await interaction.followUp({ content: message });
        sentCount++;
      } catch (fatalErr) {
        logger.error(`Unrecoverable error on message ${sentCount + 1}/${count}:`, fatalErr.message);
        break;
      }
    }
  }

  return sentCount;
}

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
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('The message content to send')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addIntegerOption((option) =>
      option
        .setName('count')
        .setDescription('Number of times to send the message (optional; default: 1, max: 1000)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(1000)
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Destination channel (optional; defaults to current channel)')
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
    const count = interaction.options.getInteger('count') || 1;
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
      // Defer ephemerally so network fetches to external channels never hit the 3-second timeout
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const targetChannel = await interaction.client.channels.fetch(channelOption.id).catch(() => null);

        if (!targetChannel || !targetChannel.isTextBased() || typeof targetChannel.send !== 'function') {
          return interaction.editReply({
            content: `❌ **Delivery Failed**: Cannot access or send messages to <#${channelOption.id}>.\n*Note: To deliver messages to a different channel, the bot application must be a member of that guild with the Send Messages permission.*`
          });
        }

        const sentCount = await sendMessagesViaChannel(targetChannel, message, count);

        return interaction.editReply({
          content: `✅ **Success**: Sent ${sentCount} of ${count} message${sentCount > 1 ? 's' : ''} to <#${targetChannel.id}>.`
        });
      } catch (error) {
        logger.error(`Failed to send message to channel ${channelOption.id}:`, error);
        return interaction.editReply({
          content: `❌ **Failed to send message**: ${error.message}`
        });
      }
    }

    // CASE 2: Current channel context (standard User-Install behavior)
    // Check if the bot has traditional guild member presence with SendMessages permission
    const isBotInGuild = interaction.guildId && interaction.client.guilds.cache.has(interaction.guildId);
    const hasSendPermission = interaction.appPermissions && interaction.appPermissions.has(PermissionFlagsBits.SendMessages);

    if (isBotInGuild && hasSendPermission && interaction.channel && typeof interaction.channel.send === 'function') {
      try {
        const sentCount = await sendMessagesViaChannel(interaction.channel, message, count);

        return await interaction.reply({
          content: `✅ **Success**: Sent ${sentCount} of ${count} message${sentCount > 1 ? 's' : ''} successfully.`,
          flags: MessageFlags.Ephemeral
        });
      } catch (err) {
        logger.warn('Direct channel.send failed, falling back to interaction reply:', err.message);
      }
    }

    // Primary User-Install path: Post directly via the interaction response & followups with rate-limit retries
    try {
      const sentCount = await sendMessagesViaInteraction(interaction, message, count);

      // Provide ephemeral confirmation to the authorized user
      const confirmationText = count === 1
        ? '✅ **Success**: Message sent successfully via application interaction.'
        : `✅ **Success**: Sent ${sentCount} of ${count} messages successfully via application interaction.`;

      await interaction.followUp({
        content: confirmationText,
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
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
