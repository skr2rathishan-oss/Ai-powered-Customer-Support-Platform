const { getMySQLPool } = require("../config/database");

async function findByBusinessEmail(email) {
  const [rows] = await getMySQLPool().execute(
    `SELECT
       u.user_id AS userId,
       c.company_id AS companyId,
       c.company_name AS companyName,
       c.business_email AS email,
       u.password_hash AS passwordHash,
       u.online_status AS onlineStatus,
       u.account_status AS accountStatus,
       c.status AS companyStatus,
       r.role_name AS roleName
     FROM companies AS c
     INNER JOIN company_admins AS ca ON ca.company_id = c.company_id
     INNER JOIN users AS u ON u.user_id = ca.admin_id
     INNER JOIN roles AS r ON r.role_id = u.role_id
     WHERE LOWER(c.business_email) = ?
     LIMIT 1`,
    [email],
  );

  return rows[0] || null;
}

module.exports = { findByBusinessEmail };
