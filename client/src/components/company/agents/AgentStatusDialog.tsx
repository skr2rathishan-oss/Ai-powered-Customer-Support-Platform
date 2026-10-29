import { useEffect, useRef } from "react";
import type { Agent } from "../../../types/agents";

interface AgentStatusDialogProps {
  agent: Agent;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AgentStatusDialog({
  agent,
  saving,
  error,
  onCancel,
  onConfirm,
}: AgentStatusDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [saving, onCancel]);

  const count = agent.openTickets;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-status-title"
        aria-describedby="agent-status-description"
        className="bg-white border border-[#e2e4e9] rounded-3xl max-w-md w-full shadow-2xl overflow-hidden"
      >
        <div className="p-6 space-y-3">
          <h2 id="agent-status-title" className="text-base font-bold text-[#1c1b23]">
            Deactivate {agent.name}?
          </h2>
          <p id="agent-status-description" className="text-sm text-[#474555]">
            {count} open {count === 1 ? "ticket" : "tickets"} will become
            unassigned. They will no longer be able to sign in.
          </p>
          {error ? (
            <p role="alert" className="text-xs font-semibold text-rose-700">
              {error}
            </p>
          ) : null}
        </div>
        <div className="p-5 border-t border-[#e2e4e9] bg-[#fbfbfe] flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl border border-[#e2e4e9] bg-white text-sm font-semibold text-[#474555] hover:bg-[#f6f2ff] cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold flex items-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-rose-400"
          >
            {saving ? <span className="spinner" aria-hidden="true" /> : null}
            {saving ? "Deactivating..." : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}
