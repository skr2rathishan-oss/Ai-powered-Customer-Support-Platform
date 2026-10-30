const {
  validateSignInPayload,
  validateCompanyRegistrationPayload,
  validateCompanyOnboardingPayload,
  validateForgotPasswordPayload,
  validateResetPasswordPayload,
} = require("../validators/authValidator");
const {
  validateCustomerRegistrationPayload,
} = require("../validators/customerValidator");

// Password strength comes from the stored platform settings. Any failure to
// resolve them falls back to the default policy.
async function loadPasswordPolicy(request) {
  try {
    const runtimeSettings = request.app?.locals?.runtimeSettings;
    return runtimeSettings ? await runtimeSettings.getPasswordPolicy() : undefined;
  } catch (_error) {
    return undefined;
  }
}

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

async function validateCompanyRegistrationRequest(request, response, next) {
  const policy = await loadPasswordPolicy(request);
  const result = validateCompanyRegistrationPayload(request.body, policy);

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

async function validateCustomerRegistrationRequest(request, response, next) {
  const policy = await loadPasswordPolicy(request);
  const result = validateCustomerRegistrationPayload(request.body, policy);

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

async function validateCompanyOnboardingRequest(request, response, next) {
  const policy = await loadPasswordPolicy(request);
  const result = validateCompanyOnboardingPayload(request.body, policy);

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

async function validateResetPasswordRequest(request, response, next) {
  const policy = await loadPasswordPolicy(request);
  const result = validateResetPasswordPayload(request.body, policy);

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
  validateCompanyOnboardingRequest,
  validateCustomerRegistrationRequest,
  validateForgotPasswordRequest,
  validateResetPasswordRequest,
};
