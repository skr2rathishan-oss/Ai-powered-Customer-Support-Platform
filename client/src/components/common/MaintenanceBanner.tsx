import { useLocation } from "react-router";
import { usePlatformSettings } from "./platformSettingsContext";

/** Top-of-page notice while maintenance mode is on; a softer reminder in the admin area. */
export function MaintenanceBanner() {
  const { maintenanceMode } = usePlatformSettings();
  const { pathname } = useLocation();

  if (!maintenanceMode) return null;

  const isAdminArea = pathname.startsWith("/admin");

  return (
    <div
      role="status"
      data-testid="maintenance-banner"
      className={`w-full px-4 py-2 text-center text-sm font-semibold ${
        isAdminArea
          ? "bg-amber-50 text-amber-900 border-b border-amber-200"
          : "bg-amber-500 text-white"
      }`}
    >
      {isAdminArea
        ? "Maintenance mode is ON. Only Platform Admins can use the platform."
        : "SupportPilot is undergoing scheduled maintenance. Some features are unavailable. Please try again shortly."}
    </div>
  );
}
