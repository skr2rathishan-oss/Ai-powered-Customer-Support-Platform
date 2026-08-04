const bcrypt = require("bcrypt");
const userModel = require("../models/userModel");
const AppError = require("../utils/AppError");
const { createAccessToken } = require("../utils/token");

// Comparing against a valid fallback hash reduces email-enumeration timing leaks.
const DUMMY_PASSWORD_HASH =
  "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

function createAuthService(dependencies = {}) {
  const users = dependencies.userModel || userModel;
  const createToken = dependencies.createAccessToken || createAccessToken;

  async function signIn({ email, password }) {
    const user = await users.findByEmail(email);
    const passwordMatches = await bcrypt.compare(
      password,
      user ? user.passwordHash : DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    if (
      user.accountStatus &&
      user.accountStatus.toLowerCase() !== "active"
    ) {
      throw new AppError("This account is not active", 403, "ACCOUNT_INACTIVE");
    }

    const safeUser = {
      userId: user.userId,
      email: user.email,
      onlineStatus: user.onlineStatus,
      roleName: user.roleName,
    };

    return {
      user: safeUser,
      accessToken: createToken(safeUser),
    };
  }

  return { signIn };
}

module.exports = { createAuthService };

