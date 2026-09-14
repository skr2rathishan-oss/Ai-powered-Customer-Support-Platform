function createAdminController(adminService) {
  async function getDashboard(request, response) {
    const timeframe = request.query.timeframe || "12months";
    const data = await adminService.getDashboardOverview(timeframe);

    return response.status(200).json({
      success: true,
      data,
    });
  }

  return {
    getDashboard,
  };
}

module.exports = { createAdminController };

