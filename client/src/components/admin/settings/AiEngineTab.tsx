import type { PlatformSettingsAi } from "../../../services/admin";

interface AiEngineTabProps {
  settings: PlatformSettingsAi;
  onChange: (patch: Partial<PlatformSettingsAi>) => void;
  onSave: () => void;
  saving: boolean;
}

export function AiEngineTab({
  settings,
  onChange,
  onSave,
  saving,
}: AiEngineTabProps) {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white border border-[#e2e4e9] rounded-2xl p-6 shadow-2xs space-y-5">
        <div>
          <h3 className="text-sm font-bold text-[#1c1b23]">AI Copilot & Model Intelligence</h3>
          <p className="text-xs text-[#787586] mt-0.5">
            Configure default foundational LLMs, response creativity, and tenant token allotments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* Default Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1c1b23] block">Default AI Foundation Model</label>
            <select
              value={settings.defaultModel}
              onChange={(e) => onChange({ defaultModel: e.target.value })}
              className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 px-3 text-xs text-[#1c1b23] focus:border-[#6D5EF5] outline-none cursor-pointer"
            >
              {settings.availableModels.map((m) => (
                <option key={m} value={m}>
                  {m === "gemini-1.5-pro"
                    ? "Google Gemini 1.5 Pro (High Reasoning)"
                    : m === "gemini-1.5-flash"
                    ? "Google Gemini 1.5 Flash (Ultra-Fast Response)"
                    : m === "gpt-4o"
                    ? "OpenAI GPT-4o"
                    : m === "claude-3.5-sonnet"
                    ? "Anthropic Claude 3.5 Sonnet"
                    : m}
                </option>
              ))}
            </select>
          </div>

          {/* Monthly Token Quota */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1c1b23] block">
              Default Monthly Token Quota / Tenant
            </label>
            <input
              type="number"
              step={50000}
              value={settings.tokenQuotaPerTenantMonth}
              onChange={(e) =>
                onChange({ tokenQuotaPerTenantMonth: Number(e.target.value) || 500000 })
              }
              className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 px-3.5 text-xs text-[#1c1b23] focus:border-[#6D5EF5] outline-none transition-all"
            />
          </div>

          {/* Temperature Slider */}
          <div className="space-y-1.5 md:col-span-2 bg-[#fbfbfe] p-4 rounded-xl border border-[#e2e4e9]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#1c1b23]">Creativity & Temperature</span>
              <span className="font-mono font-bold text-[#6D5EF5] bg-[#6D5EF5]/10 px-2 py-0.5 rounded">
                {settings.temperature}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.temperature}
              onChange={(e) => onChange({ temperature: Number(e.target.value) })}
              className="w-full accent-[#6D5EF5] cursor-pointer mt-2"
            />
            <div className="flex justify-between text-[10px] text-[#787586] pt-1">
              <span>0.0 (Deterministic / Strict Support)</span>
              <span>0.5 (Balanced)</span>
              <span>1.0 (Creative)</span>
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="space-y-3 pt-2">
          {/* Sentiment Analysis */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#fbfbfe] border border-[#e2e4e9]">
            <div>
              <p className="font-bold text-xs text-[#1c1b23]">Real-Time Customer Sentiment Tracking</p>
              <p className="text-[11px] text-[#787586]">
                Detects frustration, urgency, and satisfaction from inbound user messages.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ sentimentAnalysisEnabled: !settings.sentimentAnalysisEnabled })}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                settings.sentimentAnalysisEnabled ? "bg-[#6D5EF5]" : "bg-slate-300"
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.sentimentAnalysisEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Auto Ticket Categorization */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#fbfbfe] border border-[#e2e4e9]">
            <div>
              <p className="font-bold text-xs text-[#1c1b23]">Automatic Ticket Routing & Tagging</p>
              <p className="text-[11px] text-[#787586]">
                Automatically tags priority, department, and assigned agent category.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ autoTicketCategorization: !settings.autoTicketCategorization })}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                settings.autoTicketCategorization ? "bg-[#6D5EF5]" : "bg-slate-300"
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.autoTicketCategorization ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-3">
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="px-5 py-2.5 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] text-white text-xs font-bold transition-all shadow-md shadow-[#6D5EF5]/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">psychology</span>
            {saving ? "Saving Changes…" : "Save AI Model Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}

