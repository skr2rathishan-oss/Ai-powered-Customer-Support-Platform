const { getMySQLPool } = require("../config/database");

/**
 * Inserts a new password reset token for the specified user.
 * Tokens expire after the designated duration.
 */
async function createPasswordResetToken(userId, tokenHash, expiresAt) {
  const pool = getMySQLPool();

  const [result] = await pool.execute(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used, used_at)
     VALUES (?, ?, ?, 0, NULL)`,
    [userId, tokenHash, expiresAt],
  );

  return result.insertId;
}

/**
 * Queries the database for a token record by its SHA-256 hash.
 */
async function findTokenByHash(tokenHash) {
  const pool = getMySQLPool();
  const [rows] = await pool.execute(
    `SELECT
       t.reset_id AS tokenId,
       t.user_id AS userId,
       t.token_hash AS tokenHash,
       t.expires_at AS expiresAt,
       t.used_at AS usedAt,
       t.used AS used,
       u.email,
       u.account_status AS accountStatus
     FROM password_reset_tokens AS t
     INNER JOIN users AS u ON u.user_id = t.user_id
     WHERE t.token_hash = ?
     ORDER BY t.reset_id DESC
     LIMIT 1`,
    [tokenHash],
  );

  return rows[0] || null;
}

/**
 * Finds a token and validates in JavaScript whether it is unused and not expired.
 * Evaluating expiration in Node.js prevents database server timezone mismatches.
 */
async function findValidToken(tokenHash) {
  const record = await findTokenByHash(tokenHash);
  if (!record) return null;

  const isUsed = record.used === 1 || record.usedAt !== null;
  if (isUsed) return null;

  const isExpired = new Date(record.expiresAt).getTime() < Date.now();
  if (isExpired) return null;

  return record;
}

/**
 * Marks a specific reset token as used.
 */
async function markTokenUsed(tokenId) {
  const pool = getMySQLPool();
  await pool.execute(
    "UPDATE password_reset_tokens SET used_at = NOW(), used = 1 WHERE reset_id = ?",
    [tokenId],
  );
}

/**
 * Invalidates all active tokens for a user after a successful password reset.
 */
async function invalidateUserTokens(userId) {
  const pool = getMySQLPool();
  await pool.execute(
    "UPDATE password_reset_tokens SET used_at = NOW(), used = 1 WHERE user_id = ? AND (used_at IS NULL OR used = 0)",
    [userId],
  );
}

module.exports = {
  createPasswordResetToken,
  findTokenByHash,
  findValidToken,
  markTokenUsed,
  invalidateUserTokens,
};
