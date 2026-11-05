/**
 * Personal Discord User-Install Bot
 * Entrypoint
 */

const http = require('http');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const { initDatabase } = require('./database');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const logger = require('./utils/logger');

// Lightweight HTTP server for cloud platforms (like Render) that require an HTTP health check
function startHealthServer() {
  const port = process.env.PORT || 10000;
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Personal Discord User-Install Bot'
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  server.listen(port, () => {
    logger.info(`Health check HTTP server listening on port ${port} (Render ready)`);
  });

  return server;
}

async function bootstrap() {
  logger.info('Starting Personal Discord User-Install Bot...');

  // Start HTTP health server for Render compatibility
  const healthServer = startHealthServer();

  // 1. Initialize persistent storage
  await initDatabase();

  // 2. Initialize Discord Client
  // For User-Install application commands, standard intents are sufficient.
  // Privileged intents (like Message Content or Server Members) are NOT required.
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.DirectMessages
    ],
    partials: [
      Partials.Channel // Ensures DM channels can be received even if not cached
    ]
  });

  // 3. Load application commands and event listeners
  loadCommands(client);
  loadEvents(client);

  // 4. Graceful shutdown handlers
  const handleExit = (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    if (healthServer) healthServer.close();
    client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', () => handleExit('SIGINT'));
  process.on('SIGTERM', () => handleExit('SIGTERM'));

  // 5. Connect to Discord Gateway
  try {
    await client.login(config.token);
  } catch (error) {
    logger.error('Failed to log in to Discord:', error);
    process.exit(1);
  }
}

bootstrap().catch(err => {
  logger.error('Unhandled bootstrap exception:', err);
  process.exit(1);
});
