function createCustomerController(customerService) {
  function send(response, status, data) {
    response.set("Cache-Control", "no-store");
    return response.status(status).json({ success: true, data });
  }

  async function me(request, response) {
    return send(response, 200, await customerService.getProfile(request.auth));
  }

  async function listFaqs(request, response) {
    const data = await customerService.listFaqs(request.auth, request.query);
    return send(response, 200, data);
  }

  async function listTickets(request, response) {
    const data = await customerService.listTickets(request.auth, request.query);
    return send(response, 200, data);
  }

  async function getTicket(request, response) {
    const data = await customerService.getTicket(
      request.auth,
      request.params.ticketId,
    );
    return send(response, 200, data);
  }

  async function createTicket(request, response) {
    const data = await customerService.createTicket(request.auth, request.body);
    return send(response, 201, data);
  }

  return { me, listFaqs, listTickets, getTicket, createTicket };
}

module.exports = { createCustomerController };
