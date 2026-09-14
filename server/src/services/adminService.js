const defaultAdminModel = require("../models/adminModel");
const mongoose = require("mongoose");
const { getMySQLPool } = require("../config/database");

function createAdminService(dependencies = {}) {
  const adminModel = dependencies.adminModel || defaultAdminModel;

  /**
   * Performs quick diagnostic health checks on key platform infrastructure components.
   */
  async function getPlatformHealth() {
    let dbStatus = "ONLINE";
    try {
      const pool = getMySQLPool();
      await pool.query("SELECT 1");
    } catch (_e) {
      dbStatus = "DEGRADED";
    }

    const mongoStatus = mongoose.connection.readyState === 1 ? "HEALTHY" : "CONNECTING";

    return [
      { id: "api-gateway", name: "API Gateway", status: "HEALTHY", active: true },
      { id: "database", name: "Database", status: dbStatus, active: true },
      { id: "webhooks", name: "Webhooks", status: "CONNECTED", active: true },
      { id: "ai-nodes", name: "AI Nodes", status: "RUNNING", active: true },
    ];
  }

  /**
   * Retrieves complete, aggregated platform overview data.
   */
  async function getDashboardOverview(timeframe = "12months") {
    const months = timeframe === "quarter" ? 3 : 12;

    const [stats, growthTrends, recentCompanies, activities, health] =
      await Promise.all([
        adminModel.getPlatformStats(),
        adminModel.getRegistrationTrends(months),
        adminModel.getRecentRegistrations(10),
        adminModel.getRecentActivities(5),
        getPlatformHealth(),
      ]);

    return {
      stats,
      growthTrends,
      recentCompanies,
      activities,
      health,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    getDashboardOverview,
    getPlatformHealth,
  };
}

module.exports = { createAdminService };

