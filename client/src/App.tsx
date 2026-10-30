import { MaintenanceBanner } from "./components/common/MaintenanceBanner";
import { PlatformSettingsProvider } from "./components/common/PlatformSettingsProvider";
import { AppRouter } from "./router";

export function App() {
  return (
    <PlatformSettingsProvider>
      <MaintenanceBanner />
      <AppRouter />
    </PlatformSettingsProvider>
  );
}

export default App;
