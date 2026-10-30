const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const userModel = require("../models/userModel");
const { getGoogleCredentials } = require("./googleOAuth");

function configurePassport(dependencies = {}) {
  const User = dependencies.userModel || userModel;

  const credentials = getGoogleCredentials();
  // Dummy values only let the strategy register when Google is not configured.
  const GOOGLE_CLIENT_ID = credentials.clientId || "dummy-google-client-id";
  const GOOGLE_CLIENT_SECRET =
    credentials.clientSecret || "dummy-google-client-secret";

  const GOOGLE_CALLBACK_URL =
    process.env.GOOGLE_CALLBACK_URL ||
    "http://localhost:5000/api/auth/google/callback";

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
      function (accessToken, refreshToken, profile, cb) {
        const primaryEmail =
          profile.emails && profile.emails[0]
            ? profile.emails[0].value
            : profile._json?.email || "";

        const firstName =
          profile.name?.givenName ||
          profile._json?.given_name ||
          profile.displayName?.split(" ")[0] ||
          "";

        const lastName =
          profile.name?.familyName ||
          profile._json?.family_name ||
          profile.displayName?.split(" ").slice(1).join(" ") ||
          "";

        User.findOrCreate(
          {
            googleId: profile.id,
            email: primaryEmail,
            firstName,
            lastName,
            allowCreate: false,
          },
          function (err, user) {
            return cb(err, user || false);
          },
        );
      },
    ),
  );

  return passport;
}

module.exports = { configurePassport, passport };

