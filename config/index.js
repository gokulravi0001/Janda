/**
 * Configuration Module
 * Validates and exports all required environment variables and app settings.
 */

require('dotenv').config();

const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'OWNER_ID'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar] || process.env[envVar].trim() === '') {
    console.error(`[CONFIG ERROR] Missing required environment variable: ${envVar}`);
    console.error('Please copy .env.example to .env and configure all required variables.');
    process.exit(1);
  }
}

// Ensure OWNER_ID is a valid Discord Snowflake (17-20 digit numeric string)
const snowflakeRegex = /^\d{17,20}$/;
if (!snowflakeRegex.test(process.env.OWNER_ID.trim())) {
  console.error(`[CONFIG ERROR] OWNER_ID "${process.env.OWNER_ID}" is not a valid Discord User ID.`);
  console.error('Discord User IDs are 17-20 digit numbers. Never use usernames.');
  process.exit(1);
}

module.exports = {
  token: process.env.DISCORD_TOKEN.trim(),
  clientId: process.env.CLIENT_ID.trim(),
  ownerId: process.env.OWNER_ID.trim(),
  databasePath: process.env.DATABASE_PATH || './data/authorized_users.json',
  isProduction: process.env.NODE_ENV === 'production'
};
