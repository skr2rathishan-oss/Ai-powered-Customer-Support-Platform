function notFoundHandler(request, response) {
  return response.status(404).json({
    success: false,
    message: `Route not found: ${request.method} ${request.originalUrl}`,
  });
}

function errorHandler(error, _request, response, _next) {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return response.status(400).json({
      success: false,
      message: "Request body contains invalid JSON",
    });
  }

  const statusCode = error.statusCode || 500;
  const body = {
    success: false,
    message: statusCode === 500 ? "Internal server error" : error.message,
  };

  if (error.code) body.code = error.code;

  if (statusCode === 500 && process.env.NODE_ENV !== "test") {
    console.error(error);
  }

  return response.status(statusCode).json(body);
}

module.exports = { notFoundHandler, errorHandler };

