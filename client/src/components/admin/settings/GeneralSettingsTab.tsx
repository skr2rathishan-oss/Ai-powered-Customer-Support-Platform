import type { PlatformSettingsGeneral } from "../../../services/admin";

interface GeneralSettingsTabProps {
  settings: PlatformSettingsGeneral;
  onChange: (patch: Partial<PlatformSettingsGeneral>) => void;
  onSave: () => void;
  saving: boolean;
}

export function GeneralSettingsTab({
  settings,
  onChange,
  onSave,
  saving,
}: GeneralSettingsTabProps) {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white border border-[#e2e4e9] rounded-2xl p-6 shadow-2xs space-y-5">
        <div>
          <h3 className="text-sm font-bold text-[#1c1b23]">Platform Identity & Branding</h3>
          <p className="text-xs text-[#787586] mt-0.5">
            Configure primary organizational details and default tenant parameters.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* Platform Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1c1b23] block">Platform Brand Name</label>
            <input
              type="text"
              value={settings.platformName}
              onChange={(e) => onChange({ platformName: e.target.value })}
              className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 px-3.5 text-xs text-[#1c1b23] focus:border-[#6D5EF5] outline-none transition-all"
            />
          </div>

          {/* Support Contact Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1c1b23] block">Support Inquiries Email</label>
            <input
              type="email"
              value={settings.supportEmail}
              onChange={(e) => onChange({ supportEmail: e.target.value })}
              className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 px-3.5 text-xs text-[#1c1b23] focus:border-[#6D5EF5] outline-none transition-all"
            />
          </div>

          {/* Default Company Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1c1b23] block">New Company Initial Status</label>
            <select
              value={settings.defaultCompanyStatus}
              onChange={(e) =>
                onChange({ defaultCompanyStatus: e.target.value as "Active" | "Pending" })
              }
              className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 px-3 text-xs text-[#1c1b23] focus:border-[#6D5EF5] outline-none cursor-pointer"
            >
              <option value="Active">Active (Instant Access)</option>
              <option value="Pending">Pending (Requires Administrative Review)</option>
            </select>
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1c1b23] block">Platform Timezone</label>
            <select
              value={settings.timezone}
              onChange={(e) => onChange({ timezone: e.target.value })}
              className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 px-3 text-xs text-[#1c1b23] focus:border-[#6D5EF5] outline-none cursor-pointer"
            >
              <option value="UTC">UTC (Universal Coordinated Time)</option>
              <option value="America/New_York">Eastern Time (US/New York)</option>
              <option value="America/Los_Angeles">Pacific Time (US/Los Angeles)</option>
              <option value="Europe/London">Greenwich Mean Time (Europe/London)</option>
              <option value="Asia/Colombo">Sri Lanka / India (Asia/Colombo)</option>
              <option value="Asia/Singapore">Singapore / Hong Kong (Asia/Singapore)</option>
            </select>
          </div>
        </div>

        {/* Global Platform Banner Notice */}
        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-bold text-[#1c1b23] block">Global Platform Announcement</label>
          <textarea
            rows={2}
            value={settings.platformNotice}
            onChange={(e) => onChange({ platformNotice: e.target.value })}
            placeholder="System announcement displayed to administrators..."
            className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl p-3 text-xs text-[#1c1b23] focus:border-[#6D5EF5] outline-none transition-all resize-none"
          />
        </div>

        {/* Toggle: Self-registration */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-[#fbfbfe] border border-[#e2e4e9]">
          <div>
            <p className="font-bold text-xs text-[#1c1b23]">Allow Enterprise Self-Registration</p>
            <p className="text-[11px] text-[#787586]">
              When enabled, organizations can register via /company/register.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ allowSelfRegistration: !settings.allowSelfRegistration })}
            className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
              settings.allowSelfRegistration ? "bg-[#6D5EF5]" : "bg-slate-300"
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                settings.allowSelfRegistration ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="flex justify-end pt-3">
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="px-5 py-2.5 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] text-white text-xs font-bold transition-all shadow-md shadow-[#6D5EF5]/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">save</span>
            {saving ? "Saving Changes…" : "Save General Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

