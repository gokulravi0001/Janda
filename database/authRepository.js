/**
 * Database Module - Authorization Repository
 * Handles persistent storage and lookup for authorized Discord User IDs.
 *
 * Uses atomic JSON storage with clean async abstractions to enable
 * drop-in migration to SQLite, PostgreSQL, or Mongo in future updates.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const { isValidSnowflake } = require('../utils/permissions');

class AuthRepository {
  constructor(filePath) {
    this.filePath = path.resolve(filePath || config.databasePath);
    this.dirPath = path.dirname(this.filePath);
    this.cache = new Map();
    this.initialized = false;
  }

  /**
   * Initializes database file and directory, and loads initial state into cache.
   */
  async init() {
    if (this.initialized) return;

    try {
      if (!fs.existsSync(this.dirPath)) {
        fs.mkdirSync(this.dirPath, { recursive: true });
      }

      if (!fs.existsSync(this.filePath)) {
        // Initial seed with the owner ID
        const initialData = {
          version: '1.0.0',
          description: 'Authorized Discord User IDs for User Install Bot',
          users: [
            {
              userId: config.ownerId,
              role: 'OWNER',
              addedAt: new Date().toISOString(),
              addedBy: 'SYSTEM_CONFIG',
              notes: 'Primary Application Owner'
            }
          ]
        };
        await this._writeAtomic(initialData);
        logger.info(`Initialized authorization database at ${this.filePath}`);
      }

      await this._loadCache();
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize authorization repository:', error);
      throw error;
    }
  }

  /**
   * Loads records into memory cache for instant, non-blocking lookups.
   */
  async _loadCache() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(raw);
      this.cache.clear();

      // Always ensure the OWNER_ID from config is authorized
      this.cache.set(config.ownerId, {
        userId: config.ownerId,
        role: 'OWNER',
        addedAt: new Date().toISOString(),
        addedBy: 'SYSTEM_CONFIG',
        notes: 'Primary Application Owner'
      });

      if (Array.isArray(data.users)) {
        for (const user of data.users) {
          if (user && user.userId && isValidSnowflake(user.userId)) {
            this.cache.set(user.userId, user);
          }
        }
      }
    } catch (error) {
      logger.error('Error reading authorization file:', error);
      throw error;
    }
  }

  /**
   * Safely writes data using a temporary file and atomic rename.
   */
  async _writeAtomic(data) {
    const tempFile = `${this.filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, this.filePath);
  }

  /**
   * Checks if a Discord User ID is authorized.
   * @param {string} userId - Discord User ID (snowflake)
   * @returns {Promise<boolean>}
   */
  async isAuthorized(userId) {
    if (!userId || typeof userId !== 'string') return false;
    const cleanId = userId.trim();

    // Owner is always authorized
    if (cleanId === config.ownerId) {
      return true;
    }

    if (!this.initialized) {
      await this.init();
    }

    return this.cache.has(cleanId);
  }

  /**
   * Authorizes a new Discord User ID.
   * @param {string} userId - Discord User ID to authorize
   * @param {string} addedBy - Discord User ID of the owner who authorized
   * @param {string} [notes] - Optional note/reason
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async addAuthorizedUser(userId, addedBy, notes = '') {
    if (!this.initialized) await this.init();

    const cleanId = String(userId).trim();
    if (!isValidSnowflake(cleanId)) {
      return { success: false, message: `Invalid Discord User ID: "${userId}". User IDs must be 17-20 digit numbers.` };
    }

    if (cleanId === config.ownerId) {
      return { success: false, message: 'This user ID is the Application Owner and is already permanently authorized.' };
    }

    if (this.cache.has(cleanId)) {
      return { success: false, message: `User ID ${cleanId} is already authorized.` };
    }

    const newUser = {
      userId: cleanId,
      role: 'AUTHORIZED_USER',
      addedAt: new Date().toISOString(),
      addedBy: addedBy || config.ownerId,
      notes: notes || 'Authorized User'
    };

    this.cache.set(cleanId, newUser);

    const data = {
      version: '1.0.0',
      description: 'Authorized Discord User IDs for User Install Bot',
      users: Array.from(this.cache.values())
    };

    await this._writeAtomic(data);
    logger.security(`User ID ${cleanId} authorized by ${addedBy || config.ownerId}`);
    return { success: true, message: `Successfully authorized user ID ${cleanId}.` };
  }

  /**
   * Revokes authorization for a Discord User ID.
   * @param {string} userId - Discord User ID to revoke
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async removeAuthorizedUser(userId) {
    if (!this.initialized) await this.init();

    const cleanId = String(userId).trim();
    if (cleanId === config.ownerId) {
      return { success: false, message: 'Cannot revoke authorization from the Application Owner.' };
    }

    if (!this.cache.has(cleanId)) {
      return { success: false, message: `User ID ${cleanId} is not in the authorized list.` };
    }

    this.cache.delete(cleanId);

    const data = {
      version: '1.0.0',
      description: 'Authorized Discord User IDs for User Install Bot',
      users: Array.from(this.cache.values())
    };

    await this._writeAtomic(data);
    logger.security(`User ID ${cleanId} authorization revoked.`);
    return { success: true, message: `Successfully revoked authorization for user ID ${cleanId}.` };
  }

  /**
   * Returns list of all authorized users.
   * @returns {Promise<Array<object>>}
   */
  async getAuthorizedUsers() {
    if (!this.initialized) await this.init();
    return Array.from(this.cache.values());
  }
}

module.exports = new AuthRepository();
