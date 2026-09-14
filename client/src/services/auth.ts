import type {
  CompanyRegistrationErrors,
  CompanyRegistrationPayload,
  LoginCredentials,
  LoginMode,
  LoginResult,
} from "../types/auth";
import {
  API_BASE_URL,
  getAuthToken,
  setAuthToken,
  setStoredUser,
  removeAuthToken,
  removeStoredUser,
} from "./apiClient";

interface SignInResponse {
  success: boolean;
  message: string;
  data: {
    user: LoginResult["user"];
    token?: string;
  };
}

interface ApiErrorResponse {
  message?: string;
  errors?: Array<{ field?: string; message?: string }>;
  error?: {
    message?: string;
  };
}

export class AuthenticationError extends Error {
  readonly status: number;
  readonly fieldErrors: CompanyRegistrationErrors;

  constructor(
    message: string,
    status: number,
    fieldErrors: CompanyRegistrationErrors = {},
  ) {
    super(message);
    this.name = "AuthenticationError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export async function registerCompany(
  registration: CompanyRegistrationPayload,
): Promise<LoginResult> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/auth/company/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...registration,
        companyName: registration.companyName.trim(),
        industry: registration.industry.trim(),
        businessEmail: registration.businessEmail.trim().toLowerCase(),
        phone: registration.phone.trim(),
        website: registration.website.trim(),
        description: registration.description.trim(),
        adminFirstName: registration.adminFirstName.trim(),
        adminLastName: registration.adminLastName.trim(),
        adminEmail: registration.adminEmail.trim().toLowerCase(),
      }),
    });
  } catch {
    throw new AuthenticationError(
      "We couldn’t reach SupportPilot. Check your connection and try again.",
      0,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | SignInResponse
    | ApiErrorResponse
    | null;

  if (!response.ok) {
    const apiError = payload as ApiErrorResponse | null;
    const fieldErrors = (apiError?.errors ?? []).reduce<CompanyRegistrationErrors>(
      (current, error) => {
        if (error.field && error.message) {
          current[error.field as keyof CompanyRegistrationErrors] = error.message;
        }
        return current;
      },
      {},
    );

    throw new AuthenticationError(
      apiError?.message ?? "Company registration failed. Please try again.",
      response.status,
      fieldErrors,
    );
  }

  const result = payload as SignInResponse;
  if (result.data?.token) {
    setAuthToken(result.data.token);
  }
  if (result.data?.user) {
    setStoredUser(result.data.user);
  }
  return { message: result.message, user: result.data.user };
}

async function signIn(
  accountType: LoginMode,
  credentials: LoginCredentials,
): Promise<LoginResult> {
  let response: Response;

  try {
    const token = getAuthToken();
    const authHeaders: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    response = await fetch(`${API_BASE_URL}/api/auth/sign-in`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        accountType,
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      }),
    });
  } catch {
    throw new AuthenticationError(
      "We couldn’t reach SupportPilot. Check your connection and try again.",
      0,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | SignInResponse
    | ApiErrorResponse
    | null;

  if (!response.ok) {
    const apiError = payload as ApiErrorResponse | null;
    const message =
      payload?.message ??
      apiError?.error?.message ??
      (response.status === 401
        ? "The email or password you entered is incorrect."
        : "Sign in failed. Please try again.");

    throw new AuthenticationError(message, response.status);
  }

  const result = payload as SignInResponse;
  if (result.data?.token) {
    setAuthToken(result.data.token);
  }
  if (result.data?.user) {
    setStoredUser(result.data.user);
  }
  return {
    message: result.message,
    user: result.data.user,
  };
}

export async function signOut(): Promise<void> {
  removeAuthToken();
  removeStoredUser();
  try {
    await fetch(`${API_BASE_URL}/api/auth/sign-out`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Ignore network error on sign-out
  }
}

// The server currently exposes one role-aware sign-in endpoint. Keep these
// wrappers separate so each mode can move to its own endpoint without changing UI code.
export function loginIndividual(
  credentials: LoginCredentials,
): Promise<LoginResult> {
  return signIn("individual", credentials);
}

export function loginCompany(
  credentials: LoginCredentials,
): Promise<LoginResult> {
  return signIn("company", credentials);
}

export const logout = signOut;

export async function requestPasswordReset(email: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
  } catch {
    throw new AuthenticationError(
      "We couldn’t reach SupportPilot. Check your connection and try again.",
      0,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; message?: string; resetToken?: string }
    | ApiErrorResponse
    | null;

  if (!response.ok) {
    const apiError = payload as ApiErrorResponse | null;
    throw new AuthenticationError(
      apiError?.message ?? "Unable to send password reset link. Please try again.",
      response.status,
    );
  }

  return (payload as { message?: string })?.message ?? "Password reset link sent.";
}

export async function verifyResetToken(
  token: string,
): Promise<{ valid: boolean; email: string }> {
  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}/api/auth/verify-reset-token?token=${encodeURIComponent(token.trim())}`,
    );
  } catch {
    throw new AuthenticationError(
      "We couldn’t reach SupportPilot. Check your connection and try again.",
      0,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | { success: boolean; data: { valid: boolean; email: string } }
    | ApiErrorResponse
    | null;

  if (!response.ok) {
    const apiError = payload as ApiErrorResponse | null;
    throw new AuthenticationError(
      apiError?.message ?? "This password reset link is invalid or has expired.",
      response.status,
    );
  }

  return (payload as { success: boolean; data: { valid: boolean; email: string } }).data;
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: token.trim(),
        password,
      }),
    });
  } catch {
    throw new AuthenticationError(
      "We couldn’t reach SupportPilot. Check your connection and try again.",
      0,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; message?: string }
    | ApiErrorResponse
    | null;

  if (!response.ok) {
    const apiError = payload as ApiErrorResponse | null;
    throw new AuthenticationError(
      apiError?.message ?? "Failed to reset password. Please try again.",
      response.status,
    );
  }

  return (payload as { message?: string })?.message ?? "Password reset successfully.";
}

