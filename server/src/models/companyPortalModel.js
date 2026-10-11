const { getMySQLPool } = require("../config/database");

/**
 * Resolves the company a user administers, straight from the database.
 * The company is never taken from the token or request parameters.
 */
async function findCompanyAdminContext(userId) {
  const [rows] = await getMySQLPool().execute(
    `SELECT
       u.user_id AS userId,
       u.first_name AS firstName,
       u.last_name AS lastName,
       u.email AS email,
       u.online_status AS onlineStatus,
       u.account_status AS userStatus,
       r.role_name AS roleName,
       c.company_id AS companyId,
       c.company_name AS companyName,
       c.industry AS industry,
       c.business_email AS businessEmail,
       c.company_phone AS phone,
       c.website_url AS website,
       c.description AS description,
       c.status AS companyStatus,
       c.registration_date AS registrationDate
     FROM company_admins AS ca
     INNER JOIN users AS u ON u.user_id = ca.admin_id
     INNER JOIN roles AS r ON r.role_id = u.role_id
     INNER JOIN companies AS c ON c.company_id = ca.company_id
     WHERE ca.admin_id = ?
     LIMIT 1`,
    [userId],
  );

  return rows[0] || null;
}

async function getCompanyOverviewCounts(companyId) {
  const pool = getMySQLPool();

  const [agentRows] = await pool.execute(
    `SELECT COUNT(*) AS supportAgents
     FROM users AS u
     INNER JOIN roles AS r ON r.role_id = u.role_id
     WHERE u.company_id = ? AND r.role_name = ?`,
    [companyId, "Support Agent"],
  );

  const [openRows] = await pool.execute(
    `SELECT COUNT(*) AS openTickets
     FROM tickets
     WHERE company_id = ? AND status IN ('Open', 'In Progress')`,
    [companyId],
  );

  const [resolvedRows] = await pool.execute(
    `SELECT COUNT(*) AS resolvedToday
     FROM tickets
     WHERE company_id = ?
       AND status IN ('Resolved', 'Closed')
       AND resolved_at >= CURDATE()
       AND resolved_at < CURDATE() + INTERVAL 1 DAY`,
    [companyId],
  );

  const [faqRows] = await pool.execute(
    `SELECT COUNT(*) AS faqArticles
     FROM faqs
     WHERE company_id = ? AND is_published = 1`,
    [companyId],
  );

  return {
    supportAgents: Number(agentRows[0]?.supportAgents || 0),
    openTickets: Number(openRows[0]?.openTickets || 0),
    resolvedToday: Number(resolvedRows[0]?.resolvedToday || 0),
    faqArticles: Number(faqRows[0]?.faqArticles || 0),
  };
}

module.exports = { findCompanyAdminContext, getCompanyOverviewCounts };
