const { getMySQLPool } = require("../config/database");

async function findByEmail(email) {
  const [rows] = await getMySQLPool().execute(
    `SELECT
       u.user_id AS userId,
       u.email,
       u.password_hash AS passwordHash,
       u.online_status AS onlineStatus,
       u.account_status AS accountStatus,
       r.role_name AS roleName
     FROM users AS u
     INNER JOIN roles AS r ON r.role_id = u.role_id
     LEFT JOIN company_admins AS ca ON ca.admin_id = u.user_id
     WHERE LOWER(u.email) = ?
       AND ca.admin_id IS NULL
     LIMIT 1`,
    [email],
  );

  return rows[0] || null;
}

module.exports = { findByEmail };
