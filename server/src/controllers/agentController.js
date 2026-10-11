function createAgentController(agentService) {
  function send(response, status, data) {
    response.set("Cache-Control", "no-store");
    return response.status(status).json({ success: true, data });
  }

  async function list(request, response) {
    const data = await agentService.listAgents(request.auth);
    return send(response, 200, data);
  }

  async function invite(request, response) {
    const data = await agentService.inviteAgent(request.auth, request.body);
    return send(response, 201, data);
  }

  async function resendInvite(request, response) {
    const data = await agentService.resendInvite(
      request.auth,
      request.params.agentId,
    );
    return send(response, 200, data);
  }

  async function updateStatus(request, response) {
    const data = await agentService.setAgentStatus(
      request.auth,
      request.params.agentId,
      request.body,
    );
    return send(response, 200, data);
  }

  return { list, invite, resendInvite, updateStatus };
}

module.exports = { createAgentController };
