import { useState } from "react";
import type { PlatformSettingsEmail } from "../../../services/admin";

interface EmailSmtpTabProps {
  settings: PlatformSettingsEmail;
  onChange: (patch: Partial<PlatformSettingsEmail>) => void;
  onSave: () => void;
  onTestEmail: (email: string) => Promise<void>;
  saving: boolean;
}

export function EmailSmtpTab({
  settings,
  onChange,
  onSave,
  onTestEmail,
  saving,
}: EmailSmtpTabProps) {
  const [testEmailAddress, setTestEmailAddress] = useState("admin@supportpilot.com");
  const [testing, setTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  async function handleSendTest() {
    if (!testEmailAddress.trim()) return;
    setTesting(true);
    setTestFeedback(null);
    try {
      await onTestEmail(testEmailAddress.trim());
      setTestFeedback(`✓ Test email successfully delivered to ${testEmailAddress}. Check your inbox!`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to send test email.";
      setTestFeedback(`✕ Delivery error: ${msg}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* SMTP Configuration Card */}
      <div className="bg-white border border-[#e2e4e9] rounded-2xl p-6 shadow-2xs space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#1c1b23]">Gmail SMTP Gateway Configuration</h3>
            <p className="text-xs text-[#787586] mt-0.5">
              Outbound transactional emails, password resets, and notifications relay settings.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            STARTTLS Port 587
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* SMTP Host */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1c1b23] block">SMTP Host</label>
            <input
              type="text"
              value={settings.smtpHost}
              onChange={(e) => onChange({ smtpHost: e.target.value })}
              className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 px-3.5 text-xs text-[#1c1b23] focus:border-[#6D5EF5] outline-none transition-all font-mono"
            />
          </div>

          {/* SMTP Port */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1c1b23] block">SMTP Port</label>
            <input
              type="number"
              value={settings.smtpPort}
              onChange={(e) => onChange({ smtpPort: Number(e.target.value) || 587 })}
              className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 px-3.5 text-xs text-[#1c1b23] focus:border-[#6D5EF5] outline-none transition-all font-mono"
            />
          </div>

          {/* SMTP User */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1c1b23] block">SMTP User / Account</label>
            <input
              type="text"
              value={settings.smtpUser}
              onChange={(e) => onChange({ smtpUser: e.target.value })}
              className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 px-3.5 text-xs text-[#1c1b23] focus:border-[#6D5EF5] outline-none transition-all font-mono"
            />
          </div>

          {/* Sender Display Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1c1b23] block">Sender Display Name</label>
            <input
              type="text"
              value={settings.senderName}
              onChange={(e) => onChange({ senderName: e.target.value })}
              className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 px-3.5 text-xs text-[#1c1b23] focus:border-[#6D5EF5] outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="px-5 py-2.5 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] text-white text-xs font-bold transition-all shadow-md shadow-[#6D5EF5]/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">mail</span>
            {saving ? "Saving Changes…" : "Save SMTP Settings"}
          </button>
        </div>
      </div>

      {/* Live Diagnostic Email Test Console */}
      <div className="bg-[#fbfbfe] border border-[#e2e4e9] rounded-2xl p-6 shadow-2xs space-y-4">
        <div>
          <h4 className="text-xs font-bold text-[#1c1b23] uppercase tracking-wider">
            Live Diagnostic Email Sender
          </h4>
          <p className="text-xs text-[#787586] mt-0.5">
            Trigger a real-time test email to verify Gmail SMTP socket connectivity and TLS negotiation.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="email"
            placeholder="Recipient email (e.g. admin@supportpilot.com)"
            value={testEmailAddress}
            onChange={(e) => setTestEmailAddress(e.target.value)}
            className="w-full bg-white border border-[#e2e4e9] rounded-xl py-2 px-3.5 text-xs text-[#1c1b23] focus:border-[#6D5EF5] outline-none transition-all"
          />
          <button
            type="button"
            disabled={testing}
            onClick={handleSendTest}
            className="w-full sm:w-auto shrink-0 px-5 py-2.5 rounded-xl bg-[#1c1b23] hover:bg-[#2d2b38] text-white text-xs font-bold transition-all shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span className={`material-symbols-outlined text-sm ${testing ? "animate-spin" : ""}`}>
              send
            </span>
            {testing ? "Sending Test…" : "Send Test Email"}
          </button>
        </div>

        {testFeedback && (
          <div
            className={`p-3 rounded-xl text-xs font-medium ${
              testFeedback.startsWith("✓")
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {testFeedback}
          </div>
        )}
      </div>
    </div>
  );
}

