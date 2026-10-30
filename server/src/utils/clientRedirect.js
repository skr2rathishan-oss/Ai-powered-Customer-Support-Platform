function getClientOrigin() {
  return process.env.CLIENT_ORIGIN || "http://localhost:5173";
}

// Redirect targets are always built from CLIENT_ORIGIN, never from request input.
function clientRedirect(response, path, query = {}) {
  const url = new URL(path, getClientOrigin());
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return response.redirect(url.toString());
}

module.exports = { clientRedirect, getClientOrigin };
