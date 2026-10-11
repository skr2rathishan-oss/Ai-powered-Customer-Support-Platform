const express = require("express");
const asyncHandler = require("../utils/asyncHandler");

// Unauthenticated endpoints. Only id and name of Active companies are exposed.
function createPublicRouter(customerModel) {
  const router = express.Router();

  router.get(
    "/companies",
    asyncHandler(async (_request, response) => {
      const rows = await customerModel.listPublicCompanies();
      const companies = rows.map((row) => ({
        companyId: row.companyId,
        companyName: row.companyName,
      }));
      response.set("Cache-Control", "no-store");
      return response.status(200).json({ success: true, data: { companies } });
    }),
  );

  return router;
}

module.exports = { createPublicRouter };
