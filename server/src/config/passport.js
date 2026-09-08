const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const userModel = require("../models/userModel");

function configurePassport(dependencies = {}) {
  const User = dependencies.userModel || userModel;

  const GOOGLE_CLIENT_ID =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.Google_CLIENT_ID ||
    "dummy-google-client-id";

  const GOOGLE_CLIENT_SECRET =
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.Google_CLIENT_SECRET ||
    "dummy-google-client-secret";

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
          },
          function (err, user) {
            return cb(err, user);
          },
        );
      },
    ),
  );

  return passport;
}

module.exports = { configurePassport, passport };

