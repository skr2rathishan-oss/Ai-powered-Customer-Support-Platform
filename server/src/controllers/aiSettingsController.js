function createAiSettingsController(aiSettingsService) {
  function send(response, status, data) {
    response.set("Cache-Control", "no-store");
    return response.status(status).json({ success: true, data });
  }

  async function get(request, response) {
    const data = await aiSettingsService.getSettings(request.auth);
    return send(response, 200, data);
  }

  async function update(request, response) {
    const data = await aiSettingsService.updateSettings(request.auth, request.body);
    return send(response, 200, data);
  }

  return { get, update };
}

module.exports = { createAiSettingsController };
