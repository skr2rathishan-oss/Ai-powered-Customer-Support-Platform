import type {
  AiSettings,
  AiSettingsFieldError,
  AiSettingsResult,
} from "../types/aiSettings";
import { ApiError, apiRequest } from "./apiClient";

interface Envelope<T> {
  success: boolean;
  data: T;
}

const BASE = "/api/company/ai-settings";

export async function getAiSettings(): Promise<AiSettingsResult> {
  const response = await apiRequest<Envelope<AiSettingsResult>>(BASE, {
    cache: "no-store",
  });
  return response.data;
}

export async function saveAiSettings(settings: AiSettings): Promise<AiSettingsResult> {
  const response = await apiRequest<Envelope<AiSettingsResult>>(BASE, {
    data: settings,
    method: "PUT",
  });
  return response.data;
}

export function getAiSettingsFieldErrors(error: unknown): AiSettingsFieldError[] {
  if (!(error instanceof ApiError) || error.status !== 422) return [];
  const payload = error.payload as { errors?: unknown } | null | undefined;
  if (!payload || !Array.isArray(payload.errors)) return [];
  return payload.errors.filter(
    (item): item is AiSettingsFieldError =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as AiSettingsFieldError).field === "string" &&
      typeof (item as AiSettingsFieldError).message === "string",
  );
}
