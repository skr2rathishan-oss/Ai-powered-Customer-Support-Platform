import type { PlatformSettingsSecurity } from "../../../services/admin";

interface SecuritySettingsTabProps {
  settings: PlatformSettingsSecurity;
  onChange: (patch: Partial<PlatformSettingsSecurity>) => void;
  onSave: () => void;
  saving: boolean;
}

export function SecuritySettingsTab({
  settings,
  onChange,
  onSave,
  saving,
}: SecuritySettingsTabProps) {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white border border-[#e2e4e9] rounded-2xl p-6 shadow-2xs space-y-5">
        <div>
          <h3 className="text-sm font-bold text-[#1c1b23]">Authentication & Access Security</h3>
          <p className="text-xs text-[#787586] mt-0.5">
            Manage token lifecycles, password complexities, and OAuth federated logins.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* JWT Lifespan */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1c1b23] block">JWT Token Expiration</label>
            <select
              value={settings.jwtExpiresIn}
              onChange={(e) => onChange({ jwtExpiresIn: e.target.value })}
              className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 px-3 text-xs text-[#1c1b23] focus:border-[#6D5EF5] outline-none cursor-pointer"
            >
              <option value="1h">1 Hour (Recommended)</option>
              <option value="6h">6 Hours</option>
              <option value="24h">24 Hours</option>
              <option value="7d">7 Days</option>
            </select>
          </div>

          {/* Session Idle Timeout */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1c1b23] block">
              Inactivity Session Timeout (Minutes)
            </label>
            <input
              type="number"
              min={15}
              max={1440}
              value={settings.sessionIdleTimeoutMinutes}
              onChange={(e) =>
                onChange({ sessionIdleTimeoutMinutes: Number(e.target.value) || 60 })
              }
              className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 px-3.5 text-xs text-[#1c1b23] focus:border-[#6D5EF5] outline-none transition-all"
            />
          </div>

          {/* Password Min Length */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1c1b23] block">
              Minimum Password Length
            </label>
            <input
              type="number"
              min={8}
              max={32}
              value={settings.minPasswordLength}
              onChange={(e) => onChange({ minPasswordLength: Number(e.target.value) || 8 })}
              className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 px-3.5 text-xs text-[#1c1b23] focus:border-[#6D5EF5] outline-none transition-all"
            />
          </div>

          {/* Cookie SameSite Policy */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1c1b23] block">
              HTTP Cookie SameSite Policy
            </label>
            <select
              value={settings.cookieSameSite}
              onChange={(e) => onChange({ cookieSameSite: e.target.value })}
              className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 px-3 text-xs text-[#1c1b23] focus:border-[#6D5EF5] outline-none cursor-pointer"
            >
              <option value="lax">Lax (Standard Browser Cross-Port Protection)</option>
              <option value="strict">Strict (Same Origin Only)</option>
              <option value="none">None (Requires Secure HTTPS)</option>
            </select>
          </div>
        </div>

        {/* Security Toggles */}
        <div className="space-y-3 pt-2">
          {/* Require Special Character */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#fbfbfe] border border-[#e2e4e9]">
            <div>
              <p className="font-bold text-xs text-[#1c1b23]">Enforce Strong Password Complexity</p>
              <p className="text-[11px] text-[#787586]">
                Requires at least 1 uppercase, 1 lowercase, 1 number, and 1 special symbol.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ requireSpecialChar: !settings.requireSpecialChar })}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                settings.requireSpecialChar ? "bg-[#6D5EF5]" : "bg-slate-300"
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.requireSpecialChar ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Google OAuth 2.0 Status */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#fbfbfe] border border-[#e2e4e9]">
            <div>
              <p className="font-bold text-xs text-[#1c1b23]">Google OAuth 2.0 Single Sign-On</p>
              <p className="text-[11px] text-[#787586]">
                Allows agents and platform administrators to sign in with Google Workspace.
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                settings.googleOAuthEnabled
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {settings.googleOAuthEnabled ? "Enabled (Live)" : "Disabled"}
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-3">
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="px-5 py-2.5 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] text-white text-xs font-bold transition-all shadow-md shadow-[#6D5EF5]/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">shield</span>
            {saving ? "Saving Changes…" : "Save Security Policy"}
          </button>
        </div>
      </div>
    </div>
  );
}

