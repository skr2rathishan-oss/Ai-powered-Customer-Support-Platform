import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { FaqDeleteDialog } from "../../components/company/faqs/FaqDeleteDialog";
import { FaqFormModal } from "../../components/company/faqs/FaqFormModal";
import { FaqList } from "../../components/company/faqs/FaqList";
import { useCompanyPortal } from "../../components/company/useCompanyPortal";
import { ROUTES } from "../../router/routes";
import { ApiError, removeAuthToken, removeStoredUser } from "../../services/apiClient";
import { deleteFaq, listFaqs, updateFaq } from "../../services/faqs";
import type { Faq, FaqListResult, FaqStatusFilter } from "../../types/faqs";

interface Outcome {
  key: string;
  data?: FaqListResult;
  error?: string;
}

const SEARCH_DEBOUNCE_MS = 300;

const chipClass =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e2e4e9] bg-white text-xs font-semibold text-[#474555]";
const selectClass =
  "w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 px-3 text-xs text-[#1c1b23] outline-none focus:ring-2 focus:ring-[#6D5EF5]/30 focus:border-[#6D5EF5] cursor-pointer";

export function CompanyFaqsPage() {
  const { refresh } = useCompanyPortal();
  const navigate = useNavigate();

  const [reloadToken, setReloadToken] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<FaqStatusFilter>("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Faq | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busyFaqId, setBusyFaqId] = useState<number | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");

  const addButton = useRef<HTMLButtonElement>(null);
  const dialogTrigger = useRef<HTMLElement | null>(null);

  // Returns true when the failure was a session problem that was handled
  const handleAuthError = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError)) return false;
      if (error.status === 401) {
        removeAuthToken();
        removeStoredUser();
        navigate(ROUTES.LOGIN_COMPANY, { replace: true });
        return true;
      }
      if (error.status === 403) void refresh();
      return false;
    },
    [navigate, refresh],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const requestKey = `${reloadToken}|${search}|${category}|${status}`;

  useEffect(() => {
    let cancelled = false;
    listFaqs({ search, category, status })
      .then((data) => {
        if (!cancelled) setOutcome({ key: requestKey, data });
      })
      .catch((error: unknown) => {
        if (cancelled || handleAuthError(error)) return;
        setOutcome({
          key: requestKey,
          error: error instanceof Error ? error.message : "Could not load FAQs.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, search, category, status, handleAuthError]);

  const reload = () => setReloadToken((n) => n + 1);

  const loading = outcome?.key !== requestKey;
  const data = outcome?.data;
  const error = !loading ? outcome?.error : undefined;
  const summary = data?.summary;
  const categories = data?.categories ?? [];

  const hasFilters = searchInput.trim() !== "" || category !== "" || status !== "";

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setCategory("");
    setStatus("");
  }

  function setRowError(faqId: number, text: string | null) {
    setRowErrors((current) => {
      const next = { ...current };
      if (text) next[faqId] = text;
      else delete next[faqId];
      return next;
    });
  }

  function openCreate() {
    dialogTrigger.current = document.activeElement as HTMLElement | null;
    setEditingFaq(null);
    setFormOpen(true);
  }

  function openEdit(faq: Faq, trigger: HTMLElement) {
    dialogTrigger.current = trigger;
    setEditingFaq(faq);
    setFormOpen(true);
  }

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingFaq(null);
    const trigger = dialogTrigger.current;
    if (trigger && trigger.isConnected) trigger.focus();
    else addButton.current?.focus();
  }, []);

  function handleSaved(_faq: Faq, mode: "created" | "updated") {
    setFormOpen(false);
    setEditingFaq(null);
    const trigger = dialogTrigger.current;
    if (trigger && trigger.isConnected) trigger.focus();
    else addButton.current?.focus();
    setMessage(mode === "created" ? "FAQ created" : "FAQ updated");
    reload();
    void refresh();
  }

  async function handleTogglePublish(faq: Faq) {
    setBusyFaqId(faq.faqId);
    setRowError(faq.faqId, null);
    try {
      await updateFaq(faq.faqId, { isPublished: !faq.isPublished });
      setMessage(faq.isPublished ? "FAQ unpublished" : "FAQ published");
      void refresh();
      reload();
    } catch (failure) {
      if (!handleAuthError(failure)) {
        setRowError(
          faq.faqId,
          failure instanceof Error ? failure.message : "Could not update the FAQ.",
        );
      }
    } finally {
      setBusyFaqId(null);
    }
  }

  function openDelete(faq: Faq, trigger: HTMLElement) {
    dialogTrigger.current = trigger;
    setDeleteError(null);
    setDeleteTarget(faq);
  }

  const closeDelete = useCallback(() => {
    setDeleteTarget(null);
    const trigger = dialogTrigger.current;
    if (trigger && trigger.isConnected) trigger.focus();
  }, []);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    setDeleteError(null);
    try {
      await deleteFaq(deleteTarget.faqId);
      setDeleteTarget(null);
      setMessage("FAQ deleted");
      reload();
      void refresh();
    } catch (failure) {
      if (!handleAuthError(failure)) {
        setDeleteError(
          failure instanceof Error ? failure.message : "Could not delete the FAQ.",
        );
      }
    } finally {
      setDeleteSaving(false);
    }
  }

  const showEmpty = !loading && !error && data && data.summary.total === 0;
  const showNoMatch =
    !loading && !error && data && data.summary.total > 0 && data.faqs.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#6D5EF5]/10 text-[#6D5EF5] flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl" aria-hidden="true">
              quiz
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1c1b23] leading-tight">FAQs</h1>
            <p className="text-sm text-[#787586]">
              Build the knowledge base your AI assistant answers from.
            </p>
          </div>
        </div>
        <button
          ref={addButton}
          type="button"
          onClick={openCreate}
          className="px-5 py-2.5 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] text-white text-sm font-bold shadow-md shadow-[#6D5EF5]/20 flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/40"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            add
          </span>
          Add FAQ
        </button>
      </div>

      {summary ? (
        <ul className="flex flex-wrap gap-2" aria-label="FAQ summary">
          <li className={chipClass}>Published {summary.published}</li>
          <li className={chipClass}>Draft {summary.draft}</li>
        </ul>
      ) : null}

      <div role="status" className={message ? "" : "sr-only"}>
        {message ? (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
            {message}
          </div>
        ) : null}
      </div>

      <div className="bg-white border border-[#e2e4e9] rounded-2xl p-4 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-end">
          <div className="relative">
            <label htmlFor="faq-search" className="sr-only">
              Search FAQs
            </label>
            <span
              className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#787586] text-lg"
              aria-hidden="true"
            >
              search
            </span>
            <input
              id="faq-search"
              type="search"
              maxLength={100}
              placeholder="Search questions and answers"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 pl-10 pr-4 text-xs text-[#1c1b23] focus:ring-2 focus:ring-[#6D5EF5]/30 focus:border-[#6D5EF5] outline-none placeholder-[#787586]"
            />
          </div>
          <div>
            <label htmlFor="faq-filter-status" className="sr-only">
              Status
            </label>
            <select
              id="faq-filter-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as FaqStatusFilter)}
              className={selectClass}
            >
              <option value="">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <div>
            <label htmlFor="faq-filter-category" className="sr-only">
              Category
            </label>
            <select
              id="faq-filter-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={selectClass}
            >
              <option value="">All categories</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 rounded-xl border border-[#e2e4e9] bg-white text-xs font-semibold text-[#474555] hover:bg-[#f6f2ff] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/30"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="bg-white border border-[#e2e4e9] rounded-2xl shadow-2xs overflow-hidden"
        aria-busy={loading}
      >
        {loading && !data ? (
          <div role="status" className="p-6 space-y-3" aria-label="Loading FAQs">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
            ))}
            <span className="sr-only">Loading FAQs...</span>
          </div>
        ) : error ? (
          <div className="p-10 text-center space-y-3">
            <span className="material-symbols-outlined text-3xl text-rose-500" aria-hidden="true">
              error
            </span>
            <p role="alert" className="font-semibold text-rose-800 text-sm">
              {error}
            </p>
            <button
              type="button"
              onClick={reload}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : showEmpty ? (
          <div className="p-12 text-center space-y-3">
            <p className="font-semibold text-sm text-[#1c1b23]">No FAQs yet</p>
            <p className="text-xs text-[#787586]">
              Published FAQs will be used by your AI assistant to answer customers.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] text-white text-xs font-bold cursor-pointer"
            >
              Add FAQ
            </button>
          </div>
        ) : showNoMatch ? (
          <div className="p-12 text-center space-y-3">
            <p className="font-semibold text-sm text-[#1c1b23]">
              No FAQs match your filters
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 rounded-xl border border-[#e2e4e9] text-xs font-semibold text-[#474555] hover:bg-[#f6f2ff] cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : data ? (
          <div className={loading ? "opacity-60" : undefined}>
            <FaqList
              faqs={data.faqs}
              busyFaqId={busyFaqId}
              rowErrors={rowErrors}
              onEdit={openEdit}
              onTogglePublish={(faq) => void handleTogglePublish(faq)}
              onDelete={openDelete}
            />
          </div>
        ) : null}
      </div>

      {formOpen ? (
        <FaqFormModal
          faq={editingFaq}
          categories={categories}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      ) : null}
      {deleteTarget ? (
        <FaqDeleteDialog
          faq={deleteTarget}
          saving={deleteSaving}
          error={deleteError}
          onCancel={closeDelete}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}
