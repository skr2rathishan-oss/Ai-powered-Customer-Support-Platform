const { getMySQLPool } = require("../config/database");
const AppError = require("../utils/AppError");
const { PUBLIC_COMPANY_LIMIT } = require("../constants/customerConstants");

// The optional trailing `options.pool` exists for tests.
function poolFrom(options) {
  return options?.pool || getMySQLPool();
}

async function listPublicCompanies(options) {
  const [rows] = await poolFrom(options).query(
    `SELECT company_id AS companyId, company_name AS companyName
     FROM companies
     WHERE status = 'Active'
     ORDER BY company_name
     LIMIT ${PUBLIC_COMPANY_LIMIT}`,
  );

  return rows;
}

async function findActiveCompany(companyId, options) {
  const [rows] = await poolFrom(options).execute(
    `SELECT company_id AS companyId, company_name AS companyName
     FROM companies
     WHERE company_id = ? AND status = 'Active'
     LIMIT 1`,
    [companyId],
  );

  return rows[0] || null;
}

// Company comes from the user's own row (inner join: no company -> null).
// The role is returned, not filtered, so the resolver can report it.
async function findCustomerContext(userId, options) {
  const [rows] = await poolFrom(options).execute(
    `SELECT
       u.user_id AS userId,
       u.first_name AS firstName,
       u.last_name AS lastName,
       u.email AS email,
       u.account_status AS userStatus,
       r.role_name AS roleName,
       c.company_id AS companyId,
       c.company_name AS companyName,
       c.status AS companyStatus
     FROM users AS u
     INNER JOIN roles AS r ON r.role_id = u.role_id
     INNER JOIN companies AS c ON c.company_id = u.company_id
     WHERE u.user_id = ?
     LIMIT 1`,
    [userId],
  );

  return rows[0] || null;
}

function roleMissing() {
  return new AppError(
    "Customer role is not configured",
    500,
    "CUSTOMER_ROLE_MISSING",
  );
}

async function createCustomer(customer, options) {
  let result;
  try {
    [result] = await poolFrom(options).execute(
      `INSERT INTO users
         (role_id, company_id, first_name, last_name, email, password_hash,
          online_status, account_status)
       SELECT role_id, ?, ?, ?, ?, ?, 'Offline', 'Active'
         FROM roles
        WHERE role_name = 'Customer'
        LIMIT 1`,
      [
        customer.companyId,
        customer.firstName,
        customer.lastName,
        customer.email,
        customer.passwordHash,
      ],
    );
  } catch (error) {
    if (error?.code === "ER_BAD_NULL_ERROR") throw roleMissing();
    if (error?.code === "ER_DUP_ENTRY") {
      throw new AppError("An account with this email already exists", 409, "EMAIL_EXISTS", [
        { field: "email", message: "An account with this email already exists" },
      ]);
    }
    throw error;
  }

  if (!result?.affectedRows) throw roleMissing();
  if (!result?.insertId) throw new Error("Customer insert did not return an id");

  return {
    userId: result.insertId,
    companyId: customer.companyId,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
  };
}

module.exports = {
  listPublicCompanies,
  findActiveCompany,
  findCustomerContext,
  createCustomer,
};
