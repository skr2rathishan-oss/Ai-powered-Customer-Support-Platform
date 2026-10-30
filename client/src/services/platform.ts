import type { PlatformPublicSettings } from "../types/auth";
import { apiRequest } from "./apiClient";

export const DEFAULT_PLATFORM_SETTINGS: PlatformPublicSettings = {
  platformName: "SupportPilot",
  platformNotice: "",
  maintenanceMode: false,
  allowSelfRegistration: true,
  passwordPolicy: { minPasswordLength: 8, requireSpecialChar: true },
};

/** Public platform state; any failure resolves to the defaults. */
export async function getPublicPlatformSettings(): Promise<PlatformPublicSettings> {
  try {
    const response = await apiRequest<{
      data?: Partial<PlatformPublicSettings>;
    }>("/api/public/platform", { cache: "no-store" });
    const data = response?.data;
    if (!data) return DEFAULT_PLATFORM_SETTINGS;

    return {
      platformName:
        typeof data.platformName === "string" && data.platformName
          ? data.platformName
          : DEFAULT_PLATFORM_SETTINGS.platformName,
      platformNotice:
        typeof data.platformNotice === "string" ? data.platformNotice : "",
      maintenanceMode: data.maintenanceMode === true,
      allowSelfRegistration: data.allowSelfRegistration !== false,
      passwordPolicy: {
        minPasswordLength:
          Number.isInteger(data.passwordPolicy?.minPasswordLength) &&
          (data.passwordPolicy?.minPasswordLength ?? 0) >= 6
            ? (data.passwordPolicy?.minPasswordLength as number)
            : DEFAULT_PLATFORM_SETTINGS.passwordPolicy.minPasswordLength,
        requireSpecialChar: data.passwordPolicy?.requireSpecialChar !== false,
      },
    };
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}
