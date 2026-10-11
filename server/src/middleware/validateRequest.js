const {
  validateSignInPayload,
  validateCompanyRegistrationPayload,
  validateForgotPasswordPayload,
  validateResetPasswordPayload,
} = require("../validators/authValidator");
const {
  validateCustomerRegistrationPayload,
} = require("../validators/customerValidator");

function validateSignInRequest(request, response, next) {
  const result = validateSignInPayload(request.body);

  if (result.errors.length > 0) {
    return response.status(422).json({
      success: false,
      message: "Validation failed",
      errors: result.errors,
    });
  }

  request.validatedBody = result.value;
  return next();
}

function validateCompanyRegistrationRequest(request, response, next) {
  const result = validateCompanyRegistrationPayload(request.body);

  if (result.errors.length > 0) {
    return response.status(422).json({
      success: false,
      message: "Validation failed",
      errors: result.errors,
    });
  }

  request.validatedBody = result.value;
  return next();
}

function validateCustomerRegistrationRequest(request, response, next) {
  const result = validateCustomerRegistrationPayload(request.body);

  if (result.errors.length > 0) {
    return response.status(422).json({
      success: false,
      message: "Validation failed",
      errors: result.errors,
    });
  }

  request.validatedBody = result.value;
  return next();
}

function validateForgotPasswordRequest(request, response, next) {
  const result = validateForgotPasswordPayload(request.body);

  if (result.errors.length > 0) {
    return response.status(422).json({
      success: false,
      message: "Validation failed",
      errors: result.errors,
    });
  }

  request.validatedBody = result.value;
  return next();
}

function validateResetPasswordRequest(request, response, next) {
  const result = validateResetPasswordPayload(request.body);

  if (result.errors.length > 0) {
    return response.status(422).json({
      success: false,
      message: "Validation failed",
      errors: result.errors,
    });
  }

  request.validatedBody = result.value;
  return next();
}

module.exports = {
  validateSignInRequest,
  validateCompanyRegistrationRequest,
  validateCustomerRegistrationRequest,
  validateForgotPasswordRequest,
  validateResetPasswordRequest,
};
