const DUMMY_PREFIX = "dummy-";

function readValue(env, upperKey, legacyKey) {
  const value = env[upperKey] || env[legacyKey] || "";
  return typeof value === "string" ? value.trim() : "";
}

function getGoogleCredentials(env = process.env) {
  return {
    clientId: readValue(env, "GOOGLE_CLIENT_ID", "Google_CLIENT_ID"),
    clientSecret: readValue(env, "GOOGLE_CLIENT_SECRET", "Google_CLIENT_SECRET"),
  };
}

function isGoogleOAuthConfigured(env = process.env) {
  const { clientId, clientSecret } = getGoogleCredentials(env);

  return Boolean(
    clientId &&
      clientSecret &&
      !clientId.startsWith(DUMMY_PREFIX) &&
      !clientSecret.startsWith(DUMMY_PREFIX),
  );
}

module.exports = { getGoogleCredentials, isGoogleOAuthConfigured };
