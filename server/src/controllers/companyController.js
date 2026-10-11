function createCompanyController(companyService) {
  async function getMe(request, response) {
    const data = await companyService.getCompanyProfile(request.auth);

    response.set("Cache-Control", "no-store");
    return response.status(200).json({ success: true, data });
  }

  return { getMe };
}

module.exports = { createCompanyController };
