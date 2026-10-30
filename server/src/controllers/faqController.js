function createFaqController(faqService) {
  function send(response, status, data) {
    response.set("Cache-Control", "no-store");
    return response.status(status).json({ success: true, data });
  }

  async function list(request, response) {
    const data = await faqService.listFaqs(request.auth, request.query);
    return send(response, 200, data);
  }

  async function create(request, response) {
    const data = await faqService.createFaq(request.auth, request.body);
    return send(response, 201, data);
  }

  async function update(request, response) {
    const data = await faqService.updateFaq(
      request.auth,
      request.params.faqId,
      request.body,
    );
    return send(response, 200, data);
  }

  async function remove(request, response) {
    const data = await faqService.deleteFaq(request.auth, request.params.faqId);
    return send(response, 200, data);
  }

  return { list, create, update, remove };
}

module.exports = { createFaqController };
