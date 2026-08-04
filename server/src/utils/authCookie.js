const { getAuthConfig } = require("../config/auth");

function setAuthCookie(response, token) {
  const { cookieName, cookieOptions } = getAuthConfig();
  response.cookie(cookieName, token, cookieOptions);
}

function clearAuthCookie(response) {
  const { cookieName, cookieOptions } = getAuthConfig();
  const { maxAge: _maxAge, ...clearOptions } = cookieOptions;

  response.clearCookie(cookieName, clearOptions);
}

module.exports = { setAuthCookie, clearAuthCookie };

