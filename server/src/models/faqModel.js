const { getMySQLPool } = require("../config/database");
const { FAQ_LIST_LIMIT } = require("../constants/faqConstants");

// Every function takes the company id first and scopes every statement with
// the company. The optional trailing `options.pool` exists for tests.
const FAQ_SELECT = `SELECT
       faq_id AS faqId,
       question,
       answer,
       category,
       is_published AS isPublished,
       sort_order AS sortOrder,
       created_at AS createdAt,
       updated_at AS updatedAt
     FROM faqs`;

// Hard-coded column names; request keys never reach the SQL text
const UPDATABLE_COLUMNS = {
  question: "question",
  answer: "answer",
  category: "category",
  isPublished: "is_published",
  sortOrder: "sort_order",
};

function poolFrom(options) {
  return options?.pool || getMySQLPool();
}

// Escapes LIKE wildcards so user text is matched literally
function escapeLike(term) {
  return term.replace(/[\\%_]/g, "\\$&");
}

function toFaq(row) {
  return {
    faqId: row.faqId,
    question: row.question,
    answer: row.answer,
    category: row.category ?? null,
    isPublished: Boolean(Number(row.isPublished)),
    sortOrder: Number(row.sortOrder),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function listFaqs(companyId, filters = {}, options) {
  const conditions = ["company_id = ?"];
  const params = [companyId];

  if (filters.status === "published") conditions.push("is_published = 1");
  if (filters.status === "draft") conditions.push("is_published = 0");
  if (filters.category) {
    conditions.push("category = ?");
    params.push(filters.category);
  }
  if (filters.search) {
    const pattern = `%${escapeLike(filters.search)}%`;
    conditions.push(
      "(question LIKE ? ESCAPE '\\\\' OR answer LIKE ? ESCAPE '\\\\' OR category LIKE ? ESCAPE '\\\\')",
    );
    params.push(pattern, pattern, pattern);
  }

  const [rows] = await poolFrom(options).execute(
    `${FAQ_SELECT}
     WHERE ${conditions.join(" AND ")}
     ORDER BY sort_order ASC, faq_id ASC
     LIMIT ${FAQ_LIST_LIMIT}`,
    params,
  );

  return rows.map(toFaq);
}

// Unfiltered company-wide numbers so the summary and category list stay stable
async function listFaqMeta(companyId, options) {
  const pool = poolFrom(options);

  const [categoryRows] = await pool.execute(
    `SELECT DISTINCT category
     FROM faqs
     WHERE company_id = ? AND category IS NOT NULL AND category <> ''
     ORDER BY category ASC`,
    [companyId],
  );
  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total, COALESCE(SUM(is_published = 1), 0) AS published
     FROM faqs
     WHERE company_id = ?`,
    [companyId],
  );

  return {
    categories: categoryRows.map((row) => row.category),
    total: Number(countRows[0]?.total || 0),
    published: Number(countRows[0]?.published || 0),
  };
}

async function countFaqs(companyId, options) {
  const [rows] = await poolFrom(options).execute(
    "SELECT COUNT(*) AS total FROM faqs WHERE company_id = ?",
    [companyId],
  );
  return Number(rows[0]?.total || 0);
}

async function findFaq(companyId, faqId, options) {
  const [rows] = await poolFrom(options).execute(
    `${FAQ_SELECT}
     WHERE company_id = ? AND faq_id = ?
     LIMIT 1`,
    [companyId, faqId],
  );
  return rows[0] ? toFaq(rows[0]) : null;
}

async function createFaq(companyId, userId, data, options) {
  // A missing display order goes after the company's current last FAQ
  const [result] = await poolFrom(options).execute(
    `INSERT INTO faqs
       (company_id, question, answer, category, is_published, created_by, sort_order)
     SELECT ?, ?, ?, ?, ?, ?, COALESCE(?, COALESCE(MAX(sort_order), 0) + 10)
       FROM faqs
      WHERE company_id = ?`,
    [
      companyId,
      data.question,
      data.answer,
      data.category ?? null,
      data.isPublished ? 1 : 0,
      userId ?? null,
      data.sortOrder ?? null,
      companyId,
    ],
  );

  if (!result?.insertId) {
    throw new Error("FAQ insert did not return an id");
  }

  return findFaq(companyId, result.insertId, options);
}

async function updateFaq(companyId, faqId, changes, options) {
  const assignments = [];
  const params = [];
  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS)) {
    if (changes[key] === undefined) continue;
    assignments.push(`${column} = ?`);
    params.push(key === "isPublished" ? (changes[key] ? 1 : 0) : changes[key]);
  }

  if (assignments.length > 0) {
    await poolFrom(options).execute(
      `UPDATE faqs SET ${assignments.join(", ")} WHERE company_id = ? AND faq_id = ?`,
      [...params, companyId, faqId],
    );
  }

  // MySQL reports 0 changed rows for a no-op update, so re-read the row
  return findFaq(companyId, faqId, options);
}

async function deleteFaq(companyId, faqId, options) {
  const [result] = await poolFrom(options).execute(
    "DELETE FROM faqs WHERE company_id = ? AND faq_id = ?",
    [companyId, faqId],
  );
  return (result?.affectedRows || 0) > 0;
}

module.exports = {
  listFaqs,
  listFaqMeta,
  countFaqs,
  findFaq,
  createFaq,
  updateFaq,
  deleteFaq,
};
