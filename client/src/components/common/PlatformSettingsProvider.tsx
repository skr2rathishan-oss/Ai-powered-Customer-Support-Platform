import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { PlatformPublicSettings } from "../../types/auth";
import {
  DEFAULT_PLATFORM_SETTINGS,
  getPublicPlatformSettings,
} from "../../services/platform";
import { MAINTENANCE_EVENT } from "../../services/apiClient";
import { PlatformSettingsContext } from "./platformSettingsContext";

/** Loads the public platform state once, then on window focus and on a 503 maintenance reply. */
export function PlatformSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PlatformPublicSettings>(
    DEFAULT_PLATFORM_SETTINGS,
  );

  const refresh = useCallback(() => {
    getPublicPlatformSettings().then(setSettings);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener(MAINTENANCE_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(MAINTENANCE_EVENT, refresh);
    };
  }, [refresh]);

  return (
    <PlatformSettingsContext.Provider value={settings}>
      {children}
    </PlatformSettingsContext.Provider>
  );
}
