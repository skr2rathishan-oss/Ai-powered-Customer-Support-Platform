const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const userModel = require("../models/userModel");
const companyModel = require("../models/companyModel");
const tokenModel = require("../models/tokenModel");
const AppError = require("../utils/AppError");
const { createAccessToken } = require("../utils/token");
const { sendPasswordResetEmail } = require("./emailService");

// Comparing against a valid fallback hash reduces email-enumeration timing leaks.
const DUMMY_PASSWORD_HASH =
  "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function createAuthService(dependencies = {}) {
  const users = dependencies.userModel || userModel;
  const companies = dependencies.companyModel || companyModel;
  const tokens = dependencies.tokenModel || tokenModel;
  const mailSender =
    dependencies.sendPasswordResetEmail || sendPasswordResetEmail;
  const createToken = dependencies.createAccessToken || createAccessToken;
  const hashPassword =
    dependencies.hashPassword ||
    ((password) => bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 12)));
  const initialCompanyStatus =
    dependencies.initialCompanyStatus ||
    process.env.COMPANY_REGISTRATION_STATUS ||
    "Active";

  function generateToken(user) {
    return createToken(user);
  }

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

    const hashToCompare =
      account && account.passwordHash
        ? account.passwordHash
        : DUMMY_PASSWORD_HASH;

    const passwordMatches = await bcrypt.compare(password, hashToCompare);

    if (!account || !account.passwordHash || !passwordMatches) {
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
            ...(account.firstName && { firstName: account.firstName }),
            ...(account.lastName && { lastName: account.lastName }),
            ...(account.googleId && { googleId: account.googleId }),
            onlineStatus: account.onlineStatus,
            roleName: account.roleName,
          };

    return {
      user: safeUser,
      accessToken: createToken(safeUser),
    };
  }

  async function registerCompany(registration) {
    const passwordHash = await hashPassword(registration.password);
    const account = await companies.createRegistration({
      ...registration,
      password: undefined,
      passwordHash,
      companyStatus: initialCompanyStatus,
      adminStatus: "Active",
    });

    const safeUser = {
      accountType: "company",
      userId: account.userId,
      companyId: account.companyId,
      companyName: account.companyName,
      email: account.businessEmail,
      adminEmail: account.adminEmail,
      onlineStatus: account.onlineStatus,
      roleName: account.roleName,
    };

    return {
      user: safeUser,
      accessToken: createToken(safeUser),
    };
  }

  async function setPassword(userId, rawPassword) {
    const passwordHash = await hashPassword(rawPassword);
    if (users.setPassword) {
      await users.setPassword(userId, passwordHash);
    }
    return { success: true };
  }

  async function requestPasswordReset(email) {
    const cleanEmail = (email || "").trim().toLowerCase();
    const user = await users.findByEmail(cleanEmail);

    let rawToken;
    if (user && (!user.accountStatus || user.accountStatus.toLowerCase() === "active")) {
      rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      await tokens.createPasswordResetToken(user.userId, tokenHash, expiresAt);

      const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
      const resetLink = `${clientOrigin}/reset-password?token=${rawToken}`;

      // Send the actual password reset email
      if (process.env.NODE_ENV !== "test") {
        console.log(`[AUTH] Password reset link for ${cleanEmail}: ${resetLink}`);
        try {
          await mailSender(cleanEmail, resetLink);
        } catch (emailErr) {
          console.error(`[EMAIL] Failed to send password reset email to ${cleanEmail}:`, emailErr.message);
          throw new AppError(
            "Failed to send password reset email. Please try again later.",
            500,
            "EMAIL_DELIVERY_FAILED"
          );
        }
      }
    }

    return {
      success: true,
      message: "If an account matches that email address, a password reset link has been sent.",
      ...(process.env.NODE_ENV === "test" && rawToken ? { resetToken: rawToken } : {}),
    };
  }

  async function verifyResetToken(rawToken) {
    const hasToken = Boolean(rawToken && typeof rawToken === "string" && rawToken.trim().length > 0);
    console.log("[AUTH] Reset token received:", hasToken ? "YES" : "NO");
    console.log("[AUTH] Token length:", hasToken ? rawToken.trim().length : 0);

    if (!hasToken) {
      throw new AppError("Password reset token is required", 400, "MISSING_TOKEN");
    }

    const cleanToken = rawToken.trim();
    const tokenHash = hashToken(cleanToken);
    const tokenRecord = tokens.findTokenByHash
      ? await tokens.findTokenByHash(tokenHash)
      : await tokens.findValidToken(tokenHash);

    console.log("[AUTH] Token found in database:", tokenRecord ? "YES" : "NO");

    if (!tokenRecord) {
      throw new AppError(
        "This password reset link is invalid or has expired.",
        400,
        "INVALID_TOKEN",
      );
    }

    const isUsed = Boolean(tokenRecord.used === 1 || tokenRecord.usedAt);
    const isExpired = new Date(tokenRecord.expiresAt).getTime() < Date.now();

    console.log("[AUTH] Token expired:", isExpired ? "YES" : "NO");
    console.log("[AUTH] Token already used:", isUsed ? "YES" : "NO");

    if (isUsed || isExpired) {
      throw new AppError(
        "This password reset link is invalid or has expired.",
        400,
        "INVALID_TOKEN",
      );
    }

    return {
      valid: true,
      email: tokenRecord.email,
    };
  }

  async function resetPassword(rawToken, newPassword) {
    const hasToken = Boolean(rawToken && typeof rawToken === "string" && rawToken.trim().length > 0);
    if (!hasToken) {
      throw new AppError("Password reset token is required", 400, "MISSING_TOKEN");
    }

    const cleanToken = rawToken.trim();
    const tokenHash = hashToken(cleanToken);
    const tokenRecord = tokens.findTokenByHash
      ? await tokens.findTokenByHash(tokenHash)
      : await tokens.findValidToken(tokenHash);

    if (!tokenRecord) {
      throw new AppError(
        "This password reset link is invalid or has expired. Please request a new one.",
        400,
        "INVALID_TOKEN",
      );
    }

    const isUsed = Boolean(tokenRecord.used === 1 || tokenRecord.usedAt);
    const isExpired = new Date(tokenRecord.expiresAt).getTime() < Date.now();

    if (isUsed || isExpired) {
      throw new AppError(
        "This password reset link is invalid or has expired. Please request a new one.",
        400,
        "INVALID_TOKEN",
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await users.setPassword(tokenRecord.userId, passwordHash);
    await tokens.markTokenUsed(tokenRecord.tokenId);
    if (tokens.invalidateUserTokens) {
      await tokens.invalidateUserTokens(tokenRecord.userId);
    }

    if (process.env.NODE_ENV !== "test") {
      console.log(`[AUTH] Password successfully reset for user ID: ${tokenRecord.userId}`);
    }

    return {
      success: true,
      message: "Your password has been reset successfully. You can now sign in with your new password.",
    };
  }

  return {
    signIn,
    registerCompany,
    generateToken,
    setPassword,
    requestPasswordReset,
    verifyResetToken,
    resetPassword,
  };
}

module.exports = { createAuthService };
