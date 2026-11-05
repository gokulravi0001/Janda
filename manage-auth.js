/**
 * Authorization Management CLI
 *
 * Allows the application owner to safely manage authorized Discord User IDs.
 * Usage:
 *   node manage-auth.js list
 *   node manage-auth.js add <userId> [notes]
 *   node manage-auth.js remove <userId>
 */

const { initDatabase, authRepository } = require('./database');
const config = require('./config');
const logger = require('./utils/logger');

async function main() {
  await initDatabase();

  const args = process.argv.slice(2);
  const action = args[0] ? args[0].toLowerCase() : 'list';

  switch (action) {
    case 'list': {
      const users = await authRepository.getAuthorizedUsers();
      console.log('\n=== AUTHORIZED USERS LIST ===');
      console.log(`Primary Owner ID: ${config.ownerId}\n`);
      if (users.length === 0) {
        console.log('No authorized users found.');
      } else {
        users.forEach((u, i) => {
          console.log(`[${i + 1}] User ID: ${u.userId}`);
          console.log(`    Role:     ${u.role}`);
          console.log(`    Added By: ${u.addedBy}`);
          console.log(`    Added At: ${u.addedAt}`);
          console.log(`    Notes:    ${u.notes || 'None'}`);
          console.log('-----------------------------------');
        });
      }
      break;
    }

    case 'add': {
      const userId = args[1];
      const notes = args.slice(2).join(' ') || 'Added via CLI';
      if (!userId) {
        console.error('Error: Please provide a Discord User ID to authorize.');
        console.log('Usage: node manage-auth.js add <userId> [notes]');
        process.exit(1);
      }

      const result = await authRepository.addAuthorizedUser(userId, config.ownerId, notes);
      if (result.success) {
        logger.success(result.message);
      } else {
        logger.error(result.message);
        process.exit(1);
      }
      break;
    }

    case 'remove':
    case 'revoke': {
      const userId = args[1];
      if (!userId) {
        console.error('Error: Please provide a Discord User ID to revoke.');
        console.log('Usage: node manage-auth.js remove <userId>');
        process.exit(1);
      }

      const result = await authRepository.removeAuthorizedUser(userId);
      if (result.success) {
        logger.success(result.message);
      } else {
        logger.error(result.message);
        process.exit(1);
      }
      break;
    }

    default:
      console.log('Unknown action. Available actions: list, add <userId> [notes], remove <userId>');
      process.exit(1);
  }
}

main().catch(err => {
  logger.error('Error in manage-auth CLI:', err);
  process.exit(1);
});
