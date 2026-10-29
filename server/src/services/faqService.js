const defaultFaqModel = require("../models/faqModel");
const defaultCompanyPortalModel = require("../models/companyPortalModel");
const AppError = require("../utils/AppError");
const { createCompanyContextResolver } = require("./companyContext");
const {
  validateCreateFaqPayload,
  validateUpdateFaqPayload,
  validateListQuery,
  parseFaqId,
} = require("../validators/faqValidator");
const { FAQ_MAX_PER_COMPANY } = require("../constants/faqConstants");

function validationError(errors) {
  return new AppError("Validation failed", 422, "VALIDATION_ERROR", errors);
}

function faqNotFound() {
  return new AppError("FAQ not found", 404, "FAQ_NOT_FOUND");
}

function requireFaqId(rawId) {
  const faqId = parseFaqId(rawId);
  if (faqId === null) {
    throw new AppError("Invalid FAQ id", 400, "INVALID_FAQ_ID");
  }
  return faqId;
}

function createFaqService(dependencies = {}) {
  const faqModel = dependencies.faqModel || defaultFaqModel;
  const portal = dependencies.companyPortalModel || defaultCompanyPortalModel;
  const { requireActiveCompanyAdmin } = createCompanyContextResolver(portal);

  async function listFaqs(auth, query) {
    const admin = await requireActiveCompanyAdmin(auth);

    const { value, errors } = validateListQuery(query);
    if (errors.length > 0) throw validationError(errors);

    const [faqs, meta] = await Promise.all([
      faqModel.listFaqs(admin.companyId, value),
      faqModel.listFaqMeta(admin.companyId),
    ]);

    return {
      faqs,
      categories: meta.categories,
      summary: {
        total: meta.total,
        published: meta.published,
        draft: Math.max(meta.total - meta.published, 0),
      },
    };
  }

  async function createFaq(auth, body) {
    const admin = await requireActiveCompanyAdmin(auth);

    const { value, errors } = validateCreateFaqPayload(body);
    if (errors.length > 0) throw validationError(errors);

    const total = await faqModel.countFaqs(admin.companyId);
    if (total >= FAQ_MAX_PER_COMPANY) {
      throw new AppError(
        `A company can have at most ${FAQ_MAX_PER_COMPANY} FAQs`,
        409,
        "FAQ_LIMIT_REACHED",
      );
    }

    const faq = await faqModel.createFaq(admin.companyId, admin.userId, value);
    return { faq };
  }

  async function updateFaq(auth, rawFaqId, body) {
    const admin = await requireActiveCompanyAdmin(auth);
    const faqId = requireFaqId(rawFaqId);

    const { value, errors } = validateUpdateFaqPayload(body);
    if (errors.length > 0) throw validationError(errors);

    const faq = await faqModel.updateFaq(admin.companyId, faqId, value);
    if (!faq) throw faqNotFound();
    return { faq };
  }

  async function deleteFaq(auth, rawFaqId) {
    const admin = await requireActiveCompanyAdmin(auth);
    const faqId = requireFaqId(rawFaqId);

    const deleted = await faqModel.deleteFaq(admin.companyId, faqId);
    if (!deleted) throw faqNotFound();
    return { deleted: true, faqId };
  }

  return { listFaqs, createFaq, updateFaq, deleteFaq };
}

module.exports = { createFaqService };
