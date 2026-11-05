/**
 * Permissions & ID Validation Utilities
 */

const SNOWFLAKE_REGEX = /^\d{17,20}$/;

/**
 * Validates whether a given string is a valid Discord Snowflake ID.
 * @param {string} id - The ID string to check.
 * @returns {boolean} True if valid snowflake, false otherwise.
 */
function isValidSnowflake(id) {
  if (typeof id !== 'string') return false;
  return SNOWFLAKE_REGEX.test(id.trim());
}

module.exports = {
  isValidSnowflake
};
