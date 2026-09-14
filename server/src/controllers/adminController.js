function createAdminController(adminService) {
  async function getDashboard(request, response) {
    const timeframe = request.query.timeframe || "12months";
    const data = await adminService.getDashboardOverview(timeframe);

    return response.status(200).json({
      success: true,
      data,
    });
  }

  async function getCompanies(request, response) {
    const { search, status, industry, sortBy, page, limit } = request.query;
    const data = await adminService.listCompanies({
      search,
      status,
      industry,
      sortBy,
      page,
      limit,
    });

    return response.status(200).json({
      success: true,
      data,
    });
  }

  async function getCompany(request, response) {
    const companyId = Number(request.params.id);
    const data = await adminService.getCompanyDetails(companyId);

    return response.status(200).json({
      success: true,
      data,
    });
  }

  async function updateCompanyStatus(request, response) {
    const companyId = Number(request.params.id);
    const { status } = request.body || {};
    const data = await adminService.changeCompanyStatus(companyId, status);

    return response.status(200).json({
      success: true,
      message: "Company status updated successfully",
      data,
    });
  }

  async function deleteCompany(request, response) {
    const companyId = Number(request.params.id);
    const data = await adminService.deleteCompany(companyId);

    return response.status(200).json({
      success: true,
      ...data,
    });
  }

  async function getSettings(_request, response) {
    const data = await adminService.getPlatformSettings();

    return response.status(200).json({
      success: true,
      data,
    });
  }

  async function updateSettings(request, response) {
    const data = await adminService.updatePlatformSettings(request.body || {});

    return response.status(200).json(data);
  }

  async function testEmail(request, response) {
    const { email } = request.body || {};
    const targetEmail = email || request.auth?.email || "admin@supportpilot.com";
    const data = await adminService.sendDiagnosticTestEmail(targetEmail);

    return response.status(200).json(data);
  }

  async function getDiagnostics(_request, response) {
    const data = await adminService.getSystemDiagnostics();

    return response.status(200).json({
      success: true,
      data,
    });
  }

  return {
    getDashboard,
    getCompanies,
    getCompany,
    updateCompanyStatus,
    deleteCompany,
    getSettings,
    updateSettings,
    testEmail,
    getDiagnostics,
  };
}

module.exports = { createAdminController };

