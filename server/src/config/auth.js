function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseBoolean(value, fallback) {
  if (value === undefined) return fallback;
  return value === "true";
}

function getAuthConfig() {
  const jwtSecret = required("JWT_SECRET");
  const sameSite = (process.env.JWT_COOKIE_SAME_SITE || "lax").toLowerCase();
  const secure = parseBoolean(
    process.env.JWT_COOKIE_SECURE,
    process.env.NODE_ENV === "production",
  );
  const cookieMaxAgeMs = Number(
    process.env.JWT_COOKIE_MAX_AGE_MS || 60 * 60 * 1000,
  );

  if (jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }

  if (!["strict", "lax", "none"].includes(sameSite)) {
    throw new Error("JWT_COOKIE_SAME_SITE must be strict, lax, or none");
  }

  if (sameSite === "none" && !secure) {
    throw new Error("JWT_COOKIE_SECURE must be true when SameSite is none");
  }

  if (!Number.isSafeInteger(cookieMaxAgeMs) || cookieMaxAgeMs <= 0) {
    throw new Error("JWT_COOKIE_MAX_AGE_MS must be a positive integer");
  }

  return {
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
    cookieName: process.env.JWT_COOKIE_NAME || "supportpilot_access",
    cookieOptions: {
      httpOnly: true,
      secure,
      sameSite,
      path: "/",
      maxAge: cookieMaxAgeMs,
    },
  };
}

module.exports = { getAuthConfig };

