import { useEffect, useState } from "react";
import { requestDemo } from "../../services/leads";

interface DemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function DemoModal({
  isOpen,
  onClose,
  title = "Request a Live Demo",
}: DemoModalProps) {
  const [tab, setTab] = useState<"book" | "watch">("book");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [teamSize, setTeamSize] = useState("10-50 agents");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !companyName.trim()) {
      setStatus("error");
      setStatusMessage("Please fill in all required fields.");
      return;
    }

    setStatus("loading");
    try {
      const res = await requestDemo({
        name: name.trim(),
        email: email.trim(),
        companyName: companyName.trim(),
        teamSize,
        note: note.trim(),
      });
      setStatus("success");
      setStatusMessage(
        res.message ?? "Demo requested successfully! We'll be in touch soon.",
      );
    } catch {
      setStatus("error");
      setStatusMessage("Could not submit demo request. Please try again.");
    }
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="dialog-card max-w-lg w-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-dialog-title"
      >
        <button
          className="dialog-close-btn"
          type="button"
          aria-label="Close demo modal"
          onClick={onClose}
        >
          ✕
        </button>

        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setTab("book")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              tab === "book"
                ? "bg-primary text-white"
                : "text-on-surface-variant hover:bg-black/5"
            }`}
          >
            Book 1-on-1 Walkthrough
          </button>
          <button
            type="button"
            onClick={() => setTab("watch")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              tab === "watch"
                ? "bg-primary text-white"
                : "text-on-surface-variant hover:bg-black/5"
            }`}
          >
            Quick Product Tour
          </button>
        </div>

        <h2 className="dialog-title" id="demo-dialog-title">
          {tab === "book" ? title : "SupportPilot Product Tour"}
        </h2>

        {tab === "watch" ? (
          <div className="space-y-4">
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-white/20 shadow-inner flex items-center justify-center">
              <img
                src="/landing/dashboard-preview.png"
                alt="Product Demo Preview"
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-black/40">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-lg mb-3">
                  <span className="material-symbols-outlined text-3xl">
                    play_arrow
                  </span>
                </div>
                <p className="font-bold text-base">
                  SupportPilot Interactive AI Agent Overview
                </p>
                <p className="text-xs text-white/70">
                  3:15 minute walkthrough of RAG triage, omnichannel inbox, and
                  sentiment routing.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTab("book")}
              className="submit-button"
            >
              Ready to Book a Personalized Demo?
            </button>
          </div>
        ) : status === "success" ? (
          <div className="dialog-success py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-2xl">check</span>
            </div>
            <h3 className="font-bold text-lg text-on-surface mb-2">
              Demo Scheduled!
            </h3>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              {statusMessage}
            </p>
            <button
              type="button"
              className="submit-button"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <p className="dialog-description">
              See how SupportPilot can automate up to 80% of your tickets with
              zero loss in satisfaction.
            </p>

            <div className="field-group">
              <label htmlFor="demo-name">Full Name *</label>
              <input
                id="demo-name"
                type="text"
                className="input"
                placeholder="Sarah Jenkins"
                value={name}
                disabled={status === "loading"}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label htmlFor="demo-email">Work Email *</label>
              <input
                id="demo-email"
                type="email"
                className="input"
                placeholder="sarah@company.com"
                value={email}
                disabled={status === "loading"}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="field-group">
                <label htmlFor="demo-company">Company Name *</label>
                <input
                  id="demo-company"
                  type="text"
                  className="input"
                  placeholder="Acme Technologies"
                  value={companyName}
                  disabled={status === "loading"}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              <div className="field-group">
                <label htmlFor="demo-team">Support Team Size</label>
                <select
                  id="demo-team"
                  className="input"
                  value={teamSize}
                  disabled={status === "loading"}
                  onChange={(e) => setTeamSize(e.target.value)}
                >
                  <option>1-10 agents</option>
                  <option>10-50 agents</option>
                  <option>50-200 agents</option>
                  <option>200+ enterprise</option>
                </select>
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="demo-notes">What are you looking to solve?</label>
              <textarea
                id="demo-notes"
                className="input"
                rows={2}
                placeholder="e.g. Reduce response time, multi-language support"
                value={note}
                disabled={status === "loading"}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {status === "error" && (
              <p className="field-error">{statusMessage}</p>
            )}

            <div className="dialog-actions pt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={status === "loading"}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="submit-button"
                disabled={status === "loading"}
              >
                {status === "loading" ? "Submitting…" : "Confirm Demo Request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

