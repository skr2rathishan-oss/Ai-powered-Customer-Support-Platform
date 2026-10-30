function createChatController(chatService) {
  function send(response, status, data) {
    response.set("Cache-Control", "no-store");
    return response.status(status).json({ success: true, data });
  }

  async function start(request, response) {
    return send(response, 200, await chatService.startSession(request.auth));
  }

  async function get(request, response) {
    return send(response, 200, await chatService.getSession(request.auth, request.params.sessionId));
  }

  async function sendMessage(request, response) {
    const data = await chatService.sendMessage(request.auth, request.params.sessionId, request.body);
    return send(response, 201, data);
  }

  async function escalate(request, response) {
    return send(response, 200, await chatService.requestHuman(request.auth, request.params.sessionId));
  }

  async function resolve(request, response) {
    return send(response, 200, await chatService.markResolved(request.auth, request.params.sessionId));
  }

  return { start, get, sendMessage, escalate, resolve };
}

module.exports = { createChatController };
