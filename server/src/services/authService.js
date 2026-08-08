const bcrypt = require("bcrypt");
const userModel = require("../models/userModel");
const companyModel = require("../models/companyModel");
const AppError = require("../utils/AppError");
const { createAccessToken } = require("../utils/token");

// Comparing against a valid fallback hash reduces email-enumeration timing leaks.
const DUMMY_PASSWORD_HASH =
  "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

function createAuthService(dependencies = {}) {
  const users = dependencies.userModel || userModel;
  const companies = dependencies.companyModel || companyModel;
  const createToken = dependencies.createAccessToken || createAccessToken;

  async function signIn({ accountType, email, password }) {
    let account;

    if (accountType === "individual") {
      account = await users.findByEmail(email);
    } else if (accountType === "company") {
      account = await companies.findByBusinessEmail(email);
    } else {
      throw new AppError(
        "Invalid account type",
        422,
        "INVALID_ACCOUNT_TYPE",
      );
    }

    const passwordMatches = await bcrypt.compare(
      password,
      account ? account.passwordHash : DUMMY_PASSWORD_HASH,
    );

    if (!account || !passwordMatches) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    if (
      account.accountStatus &&
      account.accountStatus.toLowerCase() !== "active"
    ) {
      throw new AppError("This account is not active", 403, "ACCOUNT_INACTIVE");
    }

    if (
      accountType === "company" &&
      account.companyStatus?.toLowerCase() !== "active"
    ) {
      throw new AppError("This company is not active", 403, "COMPANY_INACTIVE");
    }

    const safeUser =
      accountType === "company"
        ? {
            accountType,
            userId: account.userId,
            companyId: account.companyId,
            companyName: account.companyName,
            email: account.email,
            onlineStatus: account.onlineStatus,
            roleName: account.roleName,
          }
        : {
            accountType,
            userId: account.userId,
            email: account.email,
            onlineStatus: account.onlineStatus,
            roleName: account.roleName,
          };

    return {
      user: safeUser,
      accessToken: createToken(safeUser),
    };
  }

  return { signIn };
}

module.exports = { createAuthService };
