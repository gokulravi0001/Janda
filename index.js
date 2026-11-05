/**
 * Personal Discord User-Install Bot
 * Entrypoint
 */

const http = require('http');
const https = require('https');
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

// Keep-alive self-pinger to prevent Render free tier from sleeping after 15 minutes
function startKeepAlive() {
  const baseUrl = process.env.RENDER_EXTERNAL_URL || 'https://janda-user-bot.onrender.com';
  const pingUrl = `${baseUrl}/health`;
  logger.info(`Starting keep-alive background pinger for ${pingUrl} (every 9 minutes)`);

  const timer = setInterval(() => {
    https.get(pingUrl, (res) => {
      logger.info(`Keep-alive ping sent to ${pingUrl} - Status: ${res.statusCode}`);
    }).on('error', (err) => {
      logger.warn(`Keep-alive ping error: ${err.message}`);
    });
  }, 9 * 60 * 1000); // 9 minutes

  return timer;
}

async function bootstrap() {
  logger.info('Starting Personal Discord User-Install Bot...');

  // Start HTTP health server for Render compatibility
  const healthServer = startHealthServer();

  // Start Keep-Alive pinger on cloud deployment
  let keepAliveTimer = null;
  if (process.env.RENDER || process.env.PORT) {
    keepAliveTimer = startKeepAlive();
  }

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
    if (keepAliveTimer) clearInterval(keepAliveTimer);
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
