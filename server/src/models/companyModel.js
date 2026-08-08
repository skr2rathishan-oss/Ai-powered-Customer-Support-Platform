const { getMySQLPool } = require("../config/database");
const AppError = require("../utils/AppError");

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

function duplicateEmailError(field, message, code) {
  return new AppError(message, 409, code, [{ field, message }]);
}

function mapDuplicateKeyError(error) {
  if (error?.code !== "ER_DUP_ENTRY") return error;

  const databaseMessage = String(error.sqlMessage || error.message || "");
  if (/business_email/i.test(databaseMessage)) {
    return duplicateEmailError(
      "businessEmail",
      "A company with this business email already exists",
      "BUSINESS_EMAIL_EXISTS",
    );
  }

  return duplicateEmailError(
    "adminEmail",
    "An account with this administrator email already exists",
    "ADMIN_EMAIL_EXISTS",
  );
}

async function createRegistration(registration, dependencies = {}) {
  const pool = dependencies.pool || getMySQLPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [companies] = await connection.execute(
      "SELECT company_id FROM companies WHERE LOWER(business_email) = ? LIMIT 1 FOR UPDATE",
      [registration.businessEmail],
    );
    if (companies.length > 0) {
      throw duplicateEmailError(
        "businessEmail",
        "A company with this business email already exists",
        "BUSINESS_EMAIL_EXISTS",
      );
    }

    const [users] = await connection.execute(
      "SELECT user_id FROM users WHERE LOWER(email) = ? LIMIT 1 FOR UPDATE",
      [registration.adminEmail],
    );
    if (users.length > 0) {
      throw duplicateEmailError(
        "adminEmail",
        "An account with this administrator email already exists",
        "ADMIN_EMAIL_EXISTS",
      );
    }

    const [roles] = await connection.execute(
      "SELECT role_id FROM roles WHERE role_name = ? LIMIT 1",
      ["Company Admin"],
    );
    if (roles.length === 0) {
      throw new AppError(
        "Company Admin role is not configured",
        500,
        "COMPANY_ADMIN_ROLE_MISSING",
      );
    }

    const [companyResult] = await connection.execute(
      `INSERT INTO companies
        (company_name, industry, business_email, company_phone, website_url, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        registration.companyName,
        registration.industry,
        registration.businessEmail,
        registration.phone,
        registration.website,
        registration.description,
        registration.companyStatus,
      ],
    );
    const companyId = companyResult.insertId;

    const [userResult] = await connection.execute(
      `INSERT INTO users
        (role_id, company_id, first_name, last_name, email, password_hash, online_status, account_status)
       VALUES (?, ?, ?, ?, ?, ?, 'Offline', ?)`,
      [
        roles[0].role_id,
        companyId,
        registration.adminFirstName,
        registration.adminLastName,
        registration.adminEmail,
        registration.passwordHash,
        registration.adminStatus,
      ],
    );
    const userId = userResult.insertId;

    await connection.execute(
      "INSERT INTO company_admins (admin_id, company_id) VALUES (?, ?)",
      [userId, companyId],
    );

    await connection.commit();
    return {
      userId,
      companyId,
      companyName: registration.companyName,
      businessEmail: registration.businessEmail,
      adminEmail: registration.adminEmail,
      onlineStatus: "Offline",
      roleName: "Company Admin",
    };
  } catch (error) {
    await connection.rollback();
    throw mapDuplicateKeyError(error);
  } finally {
    connection.release();
  }
}

module.exports = { findByBusinessEmail, createRegistration };
