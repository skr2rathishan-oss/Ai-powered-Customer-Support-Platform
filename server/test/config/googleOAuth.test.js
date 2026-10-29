const test = require("node:test");
const assert = require("node:assert/strict");
const { isGoogleOAuthConfigured } = require("../../src/config/googleOAuth");

test("isGoogleOAuthConfigured requires a real client id and secret", () => {
  assert.equal(
    isGoogleOAuthConfigured({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" }),
    true,
  );
  assert.equal(isGoogleOAuthConfigured({}), false);
  assert.equal(
    isGoogleOAuthConfigured({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "" }),
    false,
  );
  assert.equal(isGoogleOAuthConfigured({ GOOGLE_CLIENT_ID: "id" }), false);
  assert.equal(isGoogleOAuthConfigured({ GOOGLE_CLIENT_SECRET: "secret" }), false);
  assert.equal(
    isGoogleOAuthConfigured({ GOOGLE_CLIENT_ID: "  ", GOOGLE_CLIENT_SECRET: "secret" }),
    false,
  );
  assert.equal(
    isGoogleOAuthConfigured({
      GOOGLE_CLIENT_ID: "dummy-google-client-id",
      GOOGLE_CLIENT_SECRET: "dummy-google-client-secret",
    }),
    false,
  );
  assert.equal(
    isGoogleOAuthConfigured({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "dummy-x" }),
    false,
  );
});

test("isGoogleOAuthConfigured accepts the legacy Google_ casing", () => {
  assert.equal(
    isGoogleOAuthConfigured({ Google_CLIENT_ID: "id", Google_CLIENT_SECRET: "secret" }),
    true,
  );
});
