const jwt = require("jsonwebtoken");
const { getAuthConfig } = require("../config/auth");

function createAccessToken(user) {
  const config = getAuthConfig();

  return jwt.sign(
    {
      sub: String(user.userId),
      email: user.email,
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

  return jwt.verify(token, config.jwtSecret, {
    issuer: "supportpilot-api",
    audience: "supportpilot-client",
  });
}

module.exports = { createAccessToken, verifyAccessToken };

