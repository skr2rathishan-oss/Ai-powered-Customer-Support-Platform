const { getMySQLPool } = require("../config/database");

async function findByEmail(email) {
  const [rows] = await getMySQLPool().execute(
    `SELECT
       u.user_id AS userId,
       u.company_id AS companyId,
       u.google_id AS googleId,
       u.first_name AS firstName,
       u.last_name AS lastName,
       u.email,
       u.password_hash AS passwordHash,
       u.online_status AS onlineStatus,
       u.account_status AS accountStatus,
       r.role_name AS roleName
     FROM users AS u
     INNER JOIN roles AS r ON r.role_id = u.role_id
     WHERE LOWER(u.email) = ?
     LIMIT 1`,
    [email.toLowerCase().trim()],
  );

  return rows[0] || null;
}

async function findByGoogleId(googleId) {
  if (!googleId) return null;

  const [rows] = await getMySQLPool().execute(
    `SELECT
       u.user_id AS userId,
       u.company_id AS companyId,
       u.google_id AS googleId,
       u.first_name AS firstName,
       u.last_name AS lastName,
       u.email,
       u.password_hash AS passwordHash,
       u.online_status AS onlineStatus,
       u.account_status AS accountStatus,
       r.role_name AS roleName
     FROM users AS u
     INNER JOIN roles AS r ON r.role_id = u.role_id
     WHERE u.google_id = ?
     LIMIT 1`,
    [String(googleId)],
  );

  return rows[0] || null;
}

async function linkGoogleAccount(userId, googleId) {
  await getMySQLPool().execute(
    "UPDATE users SET google_id = ? WHERE user_id = ?",
    [String(googleId), userId],
  );
}

async function setPassword(userId, passwordHash) {
  await getMySQLPool().execute(
    "UPDATE users SET password_hash = ? WHERE user_id = ?",
    [passwordHash, userId],
  );
}

async function findOrCreate(userData, callback) {
  try {
    const cleanEmail = (userData.email || "").toLowerCase().trim();
    const googleId = userData.googleId ? String(userData.googleId) : null;

    if (!cleanEmail && !googleId) {
      const err = new Error("Email or Google ID is required for user lookup/creation");
      if (callback) return callback(err, null);
      throw err;
    }

    const pool = getMySQLPool();

    // 1. Try finding by Google ID first
    if (googleId) {
      const userByGoogle = await findByGoogleId(googleId);
      if (userByGoogle) {
        if (callback) return callback(null, userByGoogle);
        return userByGoogle;
      }
    }

    // 2. If not found by google_id, check if existing account matches by email
    if (cleanEmail) {
      const userByEmail = await findByEmail(cleanEmail);
      if (userByEmail) {
        // Link Google ID to existing account if not yet linked
        if (googleId && !userByEmail.googleId) {
          await linkGoogleAccount(userByEmail.userId, googleId);
          userByEmail.googleId = googleId;
        }
        if (callback) return callback(null, userByEmail);
        return userByEmail;
      }
    }

    // 3. New user - resolve default role (Agent / User)
    const [roles] = await pool.execute(
      "SELECT role_id, role_name FROM roles WHERE role_name IN ('Agent', 'User', 'Individual') ORDER BY role_id ASC LIMIT 1",
    );
    const roleId = roles[0]?.role_id || 1;
    const roleName = roles[0]?.role_name || "Agent";

    // Insert new user into MySQL with google_id and NULL password_hash
    const [insertResult] = await pool.execute(
      `INSERT INTO users
        (role_id, google_id, first_name, last_name, email, password_hash, online_status, account_status)
       VALUES (?, ?, ?, ?, ?, NULL, 'Offline', 'Active')`,
      [
        roleId,
        googleId,
        userData.firstName || "Google",
        userData.lastName || "User",
        cleanEmail,
      ],
    );

    const newUser = {
      userId: insertResult.insertId,
      googleId,
      firstName: userData.firstName || "Google",
      lastName: userData.lastName || "User",
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

module.exports = {
  findByEmail,
  findByGoogleId,
  linkGoogleAccount,
  setPassword,
  findOrCreate,
};
