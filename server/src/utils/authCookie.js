const { getAuthConfig } = require("../config/auth");

function setAuthCookie(response, token, cookieOptions) {
  const config = getAuthConfig();
  response.cookie(config.cookieName, token, cookieOptions || config.cookieOptions);
}

function clearAuthCookie(response, cookieOptions) {
  const config = getAuthConfig();
  const { maxAge: _maxAge, ...clearOptions } = cookieOptions || config.cookieOptions;

  response.clearCookie(config.cookieName, clearOptions);
}

module.exports = { setAuthCookie, clearAuthCookie };
