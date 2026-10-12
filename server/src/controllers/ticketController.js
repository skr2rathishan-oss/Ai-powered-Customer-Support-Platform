function createTicketController(ticketService) {
  function send(response, status, data) {
    response.set("Cache-Control", "no-store");
    return response.status(status).json({ success: true, data });
  }

  async function list(request, response) {
    const data = await ticketService.listTickets(request.auth, request.query);
    return send(response, 200, data);
  }

  async function get(request, response) {
    const ticket = await ticketService.getTicket(
      request.auth,
      request.params.ticketId,
    );
    return send(response, 200, { ticket });
  }

  async function create(request, response) {
    const ticket = await ticketService.createTicket(request.auth, request.body);
    return send(response, 201, { ticket });
  }

  async function update(request, response) {
    const ticket = await ticketService.updateTicket(
      request.auth,
      request.params.ticketId,
      request.body,
    );
    return send(response, 200, { ticket });
  }

  async function listAgents(request, response) {
    const data = await ticketService.listAssignableAgents(request.auth);
    return send(response, 200, data);
  }

  async function listReplies(request, response) {
    const data = await ticketService.listReplies(
      request.auth,
      request.params.ticketId,
    );
    return send(response, 200, data);
  }

  async function createReply(request, response) {
    const data = await ticketService.createReply(
      request.auth,
      request.params.ticketId,
      request.body,
    );
    return send(response, 201, data);
  }

  return { listReplies, createReply, list, get, create, update, listAgents };
}

module.exports = { createTicketController };
