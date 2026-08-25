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
    [email.toLowerCase().trim()],
  );

  return rows[0] || null;
}

async function findOrCreate(userData, callback) {
  try {
    const cleanEmail = (userData.email || "").toLowerCase().trim();
    if (!cleanEmail) {
      const err = new Error("Email is required for user lookup or creation");
      if (callback) return callback(err, null);
      throw err;
    }

    const existing = await findByEmail(cleanEmail);
    if (existing) {
      if (callback) return callback(null, existing);
      return existing;
    }

    const pool = getMySQLPool();
    const [roles] = await pool.execute(
      "SELECT role_id, role_name FROM roles WHERE role_name IN ('Agent', 'User', 'Individual') ORDER BY role_id ASC LIMIT 1",
    );
    const roleId = roles[0]?.role_id || 1;
    const roleName = roles[0]?.role_name || "Agent";

    const [insertResult] = await pool.execute(
      `INSERT INTO users
        (role_id, first_name, last_name, email, password_hash, online_status, account_status)
       VALUES (?, ?, ?, ?, ?, 'Offline', 'Active')`,
      [
        roleId,
        userData.firstName || "Google",
        userData.lastName || "User",
        cleanEmail,
        `GOOGLE_OAUTH_${userData.googleId || Date.now()}`,
      ],
    );

    const newUser = {
      userId: insertResult.insertId,
      email: cleanEmail,
      onlineStatus: "Offline",
      accountStatus: "Active",
      roleName,
    };

    if (callback) return callback(null, newUser);
    return newUser;
  } catch (error) {
    if (callback) return callback(error, null);
    throw error;
  }
}

module.exports = { findByEmail, findOrCreate };
