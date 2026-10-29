function createAgentPortalController(service) {
  function send(response, status, data) {
    response.set("Cache-Control", "no-store");
    return response.status(status).json({ success: true, data });
  }

  async function me(request, response) {
    return send(response, 200, await service.getProfile(request.auth));
  }

  async function listTickets(request, response) {
    return send(response, 200, await service.listTickets(request.auth, request.query));
  }

  async function getTicket(request, response) {
    const data = await service.getTicket(request.auth, request.params.ticketId);
    return send(response, 200, data);
  }

  async function createReply(request, response) {
    const data = await service.createReply(
      request.auth,
      request.params.ticketId,
      request.body,
    );
    return send(response, 201, data);
  }

  async function updateStatus(request, response) {
    const data = await service.updateStatus(
      request.auth,
      request.params.ticketId,
      request.body,
    );
    return send(response, 200, data);
  }

  return { me, listTickets, getTicket, createReply, updateStatus };
}

module.exports = { createAgentPortalController };
