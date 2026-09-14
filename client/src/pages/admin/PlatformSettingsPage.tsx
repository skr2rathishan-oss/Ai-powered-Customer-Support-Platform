import { useCallback, useEffect, useState } from "react";
import { AdminRouteGuard } from "../../components/admin/AdminRouteGuard";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { GeneralSettingsTab } from "../../components/admin/settings/GeneralSettingsTab";
import { SecuritySettingsTab } from "../../components/admin/settings/SecuritySettingsTab";
import { EmailSmtpTab } from "../../components/admin/settings/EmailSmtpTab";
import { AiEngineTab } from "../../components/admin/settings/AiEngineTab";
import { DiagnosticsTab } from "../../components/admin/settings/DiagnosticsTab";
import {
  fetchPlatformSettings,
  savePlatformSettings,
  triggerDiagnosticTestEmail,
  type PlatformSettingsData,
} from "../../services/admin";

type TabKey = "general" | "security" | "email" | "ai" | "diagnostics";

export function PlatformSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [settings, setSettings] = useState<PlatformSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPlatformSettings();
      setSettings(data);
    } catch (_err) {
      showToast("Failed to load platform settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleSaveSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await savePlatformSettings(settings);
      setSettings(res.settings);
      showToast("Platform configurations saved successfully.");
    } catch (_err) {
      showToast("Failed to update settings. Check system logs.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTestEmail(recipientEmail: string) {
    await triggerDiagnosticTestEmail(recipientEmail);
    showToast(`Test email queued to ${recipientEmail}`);
  }

  return (
    <AdminRouteGuard>
      <AdminLayout>
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed bottom-6 right-24 z-50 bg-[#1c1b23] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-fadeIn">
            <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
            {toastMessage}
          </div>
        )}

        <div className="space-y-8">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#6D5EF5] uppercase tracking-wider mb-1">
                <span className="material-symbols-outlined text-sm">settings</span>
                Platform Configuration
              </div>
              <h1 className="text-2xl font-bold text-[#1c1b23] tracking-tight">
                System Settings & Telemetry
              </h1>
              <p className="text-xs text-[#787586] mt-0.5">
                Configure global runtime parameters, security policies, AI model quotas, and inspect server health.
              </p>
            </div>
          </div>

          {/* Settings Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1.5 bg-[#f6f2ff] rounded-2xl border border-[#e2e4e9] overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "general"
                  ? "bg-white text-[#1c1b23] shadow-2xs"
                  : "text-[#787586] hover:text-[#1c1b23]"
              }`}
            >
              <span className="material-symbols-outlined text-base">tune</span>
              General & Branding
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("security")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "security"
                  ? "bg-white text-[#1c1b23] shadow-2xs"
                  : "text-[#787586] hover:text-[#1c1b23]"
              }`}
            >
              <span className="material-symbols-outlined text-base">shield</span>
              Security & Auth
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("email")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "email"
                  ? "bg-white text-[#1c1b23] shadow-2xs"
                  : "text-[#787586] hover:text-[#1c1b23]"
              }`}
            >
              <span className="material-symbols-outlined text-base">mail</span>
              Email & SMTP Gateway
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ai")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "ai"
                  ? "bg-white text-[#1c1b23] shadow-2xs"
                  : "text-[#787586] hover:text-[#1c1b23]"
              }`}
            >
              <span className="material-symbols-outlined text-base">psychology</span>
              AI Copilot & Models
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("diagnostics")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "diagnostics"
                  ? "bg-white text-[#1c1b23] shadow-2xs"
                  : "text-[#787586] hover:text-[#1c1b23]"
              }`}
            >
              <span className="material-symbols-outlined text-base">monitoring</span>
              System Telemetry
            </button>
          </div>

          {/* Settings Tab Content */}
          {loading || !settings ? (
            <div className="bg-white border border-[#e2e4e9] rounded-2xl p-12 text-center shadow-2xs animate-pulse space-y-3">
              <div className="w-8 h-8 rounded-full bg-[#6D5EF5]/20 mx-auto" />
              <div className="h-4 bg-slate-200 rounded w-48 mx-auto" />
              <div className="h-3 bg-slate-100 rounded w-64 mx-auto" />
            </div>
          ) : (
            <div>
              {activeTab === "general" && (
                <GeneralSettingsTab
                  settings={settings.general}
                  onChange={(patch) =>
                    setSettings({
                      ...settings,
                      general: { ...settings.general, ...patch },
                    })
                  }
                  onSave={handleSaveSettings}
                  saving={saving}
                />
              )}

              {activeTab === "security" && (
                <SecuritySettingsTab
                  settings={settings.security}
                  onChange={(patch) =>
                    setSettings({
                      ...settings,
                      security: { ...settings.security, ...patch },
                    })
                  }
                  onSave={handleSaveSettings}
                  saving={saving}
                />
              )}

              {activeTab === "email" && (
                <EmailSmtpTab
                  settings={settings.email}
                  onChange={(patch) =>
                    setSettings({
                      ...settings,
                      email: { ...settings.email, ...patch },
                    })
                  }
                  onSave={handleSaveSettings}
                  onTestEmail={handleSendTestEmail}
                  saving={saving}
                />
              )}

              {activeTab === "ai" && (
                <AiEngineTab
                  settings={settings.aiEngine}
                  onChange={(patch) =>
                    setSettings({
                      ...settings,
                      aiEngine: { ...settings.aiEngine, ...patch },
                    })
                  }
                  onSave={handleSaveSettings}
                  saving={saving}
                />
              )}

              {activeTab === "diagnostics" && <DiagnosticsTab />}
            </div>
          )}
        </div>
      </AdminLayout>
    </AdminRouteGuard>
  );
}

