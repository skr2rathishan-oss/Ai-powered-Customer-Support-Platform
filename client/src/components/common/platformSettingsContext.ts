import { createContext, useContext } from "react";
import type { PlatformPublicSettings } from "../../types/auth";
import { DEFAULT_PLATFORM_SETTINGS } from "../../services/platform";

export const PlatformSettingsContext = createContext<PlatformPublicSettings>(
  DEFAULT_PLATFORM_SETTINGS,
);

export function usePlatformSettings(): PlatformPublicSettings {
  return useContext(PlatformSettingsContext);
}
