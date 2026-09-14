const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000"
).replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

interface RequestOptions extends RequestInit {
  data?: unknown;
}

const TOKEN_STORAGE_KEY = "supportpilot.auth_token";
const USER_STORAGE_KEY = "supportpilot.auth_user";

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage access might be restricted
  }
}

export function removeAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function getStoredUser<T = unknown>(): T | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: unknown): void {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Ignore
  }
}

export function removeStoredUser(): void {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { data, headers, ...customConfig } = options;
  const token = getAuthToken();

  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const config: RequestInit = {
    method: data ? "POST" : "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...headers,
    },
    ...customConfig,
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  let response: Response;
  try {
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
    response = await fetch(url, config);
  } catch (networkError) {
    throw new ApiError(
      "Unable to connect to server. Please check your internet connection.",
      0,
      networkError,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | { message?: string; error?: { message?: string } }
    | null;

  if (!response.ok) {
    const message =
      payload?.message ??
      payload?.error?.message ??
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export { API_BASE_URL };

