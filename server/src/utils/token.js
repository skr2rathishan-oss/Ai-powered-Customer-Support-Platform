const jwt = require("jsonwebtoken");
const { getAuthConfig } = require("../config/auth");

function createAccessToken(user) {
  const config = getAuthConfig();
  const subjectId =
    user.accountType === "company" ? user.companyId : user.userId;

  return jwt.sign(
    {
      sub: `${user.accountType}:${subjectId}`,
      accountType: user.accountType,
      userId: String(user.userId),
      ...(user.companyId !== undefined && {
        companyId: String(user.companyId),
      }),
      ...(user.companyName && { companyName: user.companyName }),
      email: user.email,
      ...(user.firstName && { firstName: user.firstName }),
      ...(user.lastName && { lastName: user.lastName }),
      ...(user.googleId && { googleId: String(user.googleId) }),
      roleName: user.roleName,
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn,
      issuer: "supportpilot-api",
      audience: "supportpilot-client",
    },
  );
}

function verifyAccessToken(token) {
  const config = getAuthConfig();

  const payload = jwt.verify(token, config.jwtSecret, {
    issuer: "supportpilot-api",
    audience: "supportpilot-client",
  });

  if (
    !payload ||
    typeof payload === "string" ||
    !["individual", "company"].includes(payload.accountType) ||
    !payload.userId ||
    (payload.accountType === "company" && !payload.companyId)
  ) {
    throw new jwt.JsonWebTokenError("Invalid account session");
  }

  return payload;
}

module.exports = { createAccessToken, verifyAccessToken };
