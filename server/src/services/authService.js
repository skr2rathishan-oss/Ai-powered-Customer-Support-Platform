const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const userModel = require("../models/userModel");
const companyModel = require("../models/companyModel");
const tokenModel = require("../models/tokenModel");
const defaultCustomerModel = require("../models/customerModel");
const AppError = require("../utils/AppError");
const { createAccessToken } = require("../utils/token");
const { sendPasswordResetEmail } = require("./emailService");
const { createStaticRuntimeSettings } = require("./runtimeSettings");
const {
  isPasswordAllowed,
  passwordPolicyMessage,
} = require("../validators/authValidator");

const PLATFORM_ADMIN_ROLE = "Platform Admin";

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
  const customers = dependencies.customerModel || defaultCustomerModel;
  const mailSender =
    dependencies.sendPasswordResetEmail || sendPasswordResetEmail;
  const createToken = dependencies.createAccessToken || createAccessToken;
  const hashPassword =
    dependencies.hashPassword ||
    ((password) => bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 12)));
  const runtimeSettings =
    dependencies.runtimeSettings || createStaticRuntimeSettings();

  // Stored security settings, or undefined so token/cookie helpers use env.
  async function resolveSecurity() {
    try {
      return await runtimeSettings.getSecurity();
    } catch (_error) {
      return {};
    }
  }

  async function getCookieOptions() {
    return (await resolveSecurity()).cookieOptions;
  }

  async function generateToken(user) {
    const { jwtExpiresIn } = await resolveSecurity();
    return createToken(user, { expiresIn: jwtExpiresIn });
  }

  async function assertSelfRegistrationOpen() {
    const settings = await runtimeSettings.get();
    if (settings.general.allowSelfRegistration === false) {
      throw new AppError(
        "Self-registration is currently disabled",
        403,
        "REGISTRATION_DISABLED",
      );
    }
    return settings;
  }

  function maintenanceError() {
    return new AppError(
      "The platform is under maintenance. Please try again shortly.",
      503,
      "MAINTENANCE_MODE",
    );
  }

  // Whether this role may start a session while maintenance mode is on.
  async function isSignInBlockedByMaintenance(roleName) {
    const settings = await runtimeSettings.get();
    return (
      settings.infrastructure.maintenanceMode === true &&
      roleName !== PLATFORM_ADMIN_ROLE
    );
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

    if (await isSignInBlockedByMaintenance(safeUser.roleName)) {
      throw maintenanceError();
    }

    return {
      user: safeUser,
      accessToken: await generateToken(safeUser),
    };
  }

  async function registerCompany(registration) {
    const settings = await assertSelfRegistrationOpen();
    const initialCompanyStatus =
      dependencies.initialCompanyStatus || settings.general.defaultCompanyStatus;
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
      accessToken: await generateToken(safeUser),
    };
  }

  async function registerCustomer(registration) {
    await assertSelfRegistrationOpen();
    const company = await customers.findActiveCompany(registration.companyId);
    if (!company) {
      throw new AppError("Select an active company", 422, "COMPANY_NOT_FOUND", [
        { field: "companyId", message: "Select an active company" },
      ]);
    }

    if (await users.findByEmail(registration.email)) {
      throw new AppError("An account with this email already exists", 409, "EMAIL_EXISTS", [
        { field: "email", message: "An account with this email already exists" },
      ]);
    }

    const passwordHash = await hashPassword(registration.password);
    const customer = await customers.createCustomer({
      companyId: company.companyId,
      firstName: registration.firstName,
      lastName: registration.lastName,
      email: registration.email,
      passwordHash,
    });

    const safeUser = {
      accountType: "individual",
      userId: customer.userId,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      onlineStatus: "Offline",
      roleName: "Customer",
    };

    return { user: safeUser, accessToken: await generateToken(safeUser) };
  }

  async function setPassword(userId, rawPassword) {
    const policy = await runtimeSettings.getPasswordPolicy();
    if (!isPasswordAllowed(rawPassword, policy)) {
      throw new AppError("Validation failed", 422, "VALIDATION_ERROR", [
        { field: "password", message: passwordPolicyMessage(policy) },
      ]);
    }
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
      // Under NODE_ENV=test mail is only sent through an injected sender.
      if (process.env.NODE_ENV !== "test" || dependencies.sendPasswordResetEmail) {
        if (process.env.NODE_ENV !== "test") {
          console.log(`[AUTH] Password reset link for ${cleanEmail}: ${resetLink}`);
        }
        try {
          await mailSender(cleanEmail, resetLink, await runtimeSettings.getEmail());
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
    registerCustomer,
    generateToken,
    getCookieOptions,
    isSignInBlockedByMaintenance,
    setPassword,
    requestPasswordReset,
    verifyResetToken,
    resetPassword,
  };
}

module.exports = { createAuthService };
