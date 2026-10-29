import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useCustomerAuthError } from "../../components/customer/useCustomerAuthError";
import { useCustomerPortal } from "../../components/customer/useCustomerPortal";
import { ROUTES, customerTicketPath } from "../../router/routes";
import { ApiError } from "../../services/apiClient";
import { requestHuman, resolveChat, sendChatMessage, startChat } from "../../services/chat";
import type { ChatAssistantInfo, ChatMessage, ChatSession, ChatTurnResult } from "../../types/chat";

const MESSAGE_MAX = 2000;

function errorCode(error: unknown): string | undefined {
  return error instanceof ApiError
    ? (error.payload as { code?: string } | null | undefined)?.code
    : undefined;
}

function MessageBubble({ message, assistantName }: { message: ChatMessage; assistantName: string }) {
  if (message.sender === "system") {
    return (
      <li className="flex justify-center">
        <p className="max-w-md text-center text-xs font-medium text-[#474555] bg-[#f6f2ff] border border-[#6D5EF5]/15 rounded-xl px-4 py-2.5">
          {message.body}
        </p>
      </li>
    );
  }

  const fromCustomer = message.sender === "customer";
  return (
    <li className={`flex items-end gap-2.5 ${fromCustomer ? "justify-end" : "justify-start"}`}>
      {!fromCustomer ? (
        <span
          className="w-8 h-8 shrink-0 rounded-full bg-[#6D5EF5] text-white flex items-center justify-center"
          aria-hidden="true"
        >
          <span className="material-symbols-outlined text-base">smart_toy</span>
        </span>
      ) : null}
      <div className={`max-w-[80%] sm:max-w-[70%] ${fromCustomer ? "items-end" : "items-start"} flex flex-col`}>
        <span className="sr-only">{fromCustomer ? "You" : assistantName}:</span>
        <p
          className={`whitespace-pre-wrap break-words text-sm leading-relaxed px-4 py-2.5 rounded-2xl ${
            fromCustomer
              ? "bg-[#6D5EF5] text-white rounded-br-md"
              : "bg-white border border-[#e2e4e9] text-[#1c1b23] rounded-bl-md shadow-2xs"
          }`}
        >
          {message.body}
        </p>
      </div>
    </li>
  );
}

export function CustomerChatPage() {
  const { data } = useCustomerPortal();
  const handleAuthError = useCustomerAuthError();

  const [session, setSession] = useState<ChatSession | null>(null);
  const [assistant, setAssistant] = useState<ChatAssistantInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await startChat();
      setSession(snapshot.session);
      setAssistant(snapshot.assistant);
      setMessages(snapshot.messages);
      setUnavailable(false);
    } catch (err) {
      if (handleAuthError(err)) return;
      if (errorCode(err) === "ASSISTANT_DISABLED") setUnavailable(true);
      else setError("Could not start the chat. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the newest message in view
  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  function applyTurn(result: ChatTurnResult, replacePendingId?: number) {
    setSession(result.session);
    setMessages((current) => [
      ...current.filter((m) => m.messageId !== replacePendingId),
      ...result.messages,
    ]);
  }

  async function handleSend(event?: React.FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!session || !text || busy) return;

    // Show the customer's message straight away while the assistant replies
    const pendingId = -Date.now();
    setMessages((current) => [...current, { messageId: pendingId, sender: "customer", body: text, confidence: null }]);
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      applyTurn(await sendChatMessage(session.sessionId, text), pendingId);
    } catch (err) {
      setMessages((current) => current.filter((m) => m.messageId !== pendingId));
      setDraft(text);
      if (handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : "Message could not be sent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(action: "human" | "resolve") {
    if (!session || busy) return;
    setBusy(true);
    setError(null);
    try {
      applyTurn(await (action === "human" ? requestHuman(session.sessionId) : resolveChat(session.sessionId)));
    } catch (err) {
      if (handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const assistantName = assistant?.assistantName ?? "Assistant";
  const active = session?.status === "Active";
  const customerHasWritten = messages.some((m) => m.sender === "customer" && m.messageId > 0);

  if (loading) {
    return (
      <div className="h-[60vh] bg-white border border-[#e2e4e9] rounded-2xl animate-pulse" aria-label="Loading chat" />
    );
  }

  if (unavailable) {
    return (
      <section className="bg-white border border-[#e2e4e9] rounded-2xl p-8 text-center shadow-2xs">
        <span className="material-symbols-outlined text-4xl text-[#c9c7d3]" aria-hidden="true">
          smart_toy
        </span>
        <h1 className="text-lg font-bold text-[#1c1b23] mt-2">The assistant isn't available right now</h1>
        <p className="text-sm text-[#787586] mt-1 mb-5">
          {data.company.companyName}'s team can still help. Open a ticket and an agent will reply.
        </p>
        <Link
          to={ROUTES.CUSTOMER_NEW_TICKET}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6D5EF5] text-white text-sm font-bold no-underline hover:bg-[#5b4be8]"
        >
          <span className="material-symbols-outlined text-lg" aria-hidden="true">
            add_circle
          </span>
          Open a ticket
        </Link>
      </section>
    );
  }

  return (
    <section className="bg-white border border-[#e2e4e9] rounded-2xl shadow-2xs flex flex-col h-[calc(100vh-11rem)] min-h-[28rem] overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#e2e4e9] bg-[#fbfbfe]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="relative w-10 h-10 shrink-0 rounded-full bg-[#6D5EF5] text-white flex items-center justify-center">
            <span className="material-symbols-outlined text-xl" aria-hidden="true">
              smart_toy
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
          </span>
          <div className="min-w-0">
            <h1 className="font-bold text-sm text-[#1c1b23] truncate">{assistantName}</h1>
            <p className="text-[11px] text-[#787586]">
              {assistant?.poweredBy === "ai" ? "AI assistant · powered by NVIDIA Nemotron" : "Automated assistant · answers from our help center"}
            </p>
          </div>
        </div>
        {active && customerHasWritten ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleAction("resolve")}
              disabled={busy}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                check_circle
              </span>
              That solved it
            </button>
            <button
              type="button"
              onClick={() => void handleAction("human")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#e2e4e9] bg-white text-[#474555] text-xs font-bold hover:bg-[#f6f2ff] disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                support_agent
              </span>
              Talk to a person
            </button>
          </div>
        ) : null}
      </header>

      <ul ref={listRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4 bg-[#f8f9fc]" aria-live="polite">
        {messages.map((message) => (
          <MessageBubble key={message.messageId} message={message} assistantName={assistantName} />
        ))}
        {busy ? (
          <li className="flex items-end gap-2.5" aria-label={`${assistantName} is typing`}>
            <span className="w-8 h-8 rounded-full bg-[#6D5EF5] text-white flex items-center justify-center" aria-hidden="true">
              <span className="material-symbols-outlined text-base">smart_toy</span>
            </span>
            <span className="flex gap-1 px-4 py-3.5 bg-white border border-[#e2e4e9] rounded-2xl rounded-bl-md">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="w-1.5 h-1.5 rounded-full bg-[#787586] animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
          </li>
        ) : null}
      </ul>

      {error ? (
        <p role="alert" className="px-5 py-2 text-xs font-medium text-rose-700 bg-rose-50 border-t border-rose-200">
          {error}
        </p>
      ) : null}

      {active ? (
        <form onSubmit={handleSend} className="flex items-end gap-2 p-3 sm:p-4 border-t border-[#e2e4e9] bg-white">
          <label htmlFor="chat-message" className="sr-only">
            Message {assistantName}
          </label>
          <textarea
            id="chat-message"
            rows={1}
            value={draft}
            maxLength={MESSAGE_MAX}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Type your question…"
            className="flex-1 resize-none max-h-32 rounded-xl border border-[#e2e4e9] bg-[#f6f2ff]/50 px-4 py-2.5 text-sm text-[#1c1b23] outline-none focus:border-[#6D5EF5] focus:ring-2 focus:ring-[#6D5EF5]/20"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label="Send message"
            className="w-11 h-11 shrink-0 rounded-xl bg-[#6D5EF5] text-white flex items-center justify-center hover:bg-[#5b4be8] disabled:opacity-40 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl" aria-hidden="true">
              send
            </span>
          </button>
        </form>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-[#e2e4e9] bg-white">
          <p className="text-sm text-[#474555]">
            {session?.status === "Escalated"
              ? "This conversation was handed to our support team."
              : "This conversation is closed."}
          </p>
          <div className="flex items-center gap-2">
            {session?.ticketId ? (
              <Link
                to={customerTicketPath(session.ticketId)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6D5EF5] text-white text-xs font-bold no-underline hover:bg-[#5b4be8]"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  confirmation_number
                </span>
                View ticket #{session.ticketId}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#e2e4e9] text-[#474555] text-xs font-bold hover:bg-[#f6f2ff] cursor-pointer"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                add_comment
              </span>
              New chat
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
