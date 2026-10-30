import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useCustomerAuthError } from "../../components/customer/useCustomerAuthError";
import { ROUTES } from "../../router/routes";
import { listCustomerFaqs } from "../../services/customer";
import type { PublicFaqResult } from "../../types/customer";

const SEARCH_DEBOUNCE_MS = 300;

interface Outcome {
  key: string;
  data?: PublicFaqResult;
  error?: string;
}

export function CustomerHelpPage() {
  const handleAuthError = useCustomerAuthError();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [knownCategories, setKnownCategories] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestKey = `${search}|${category}|${reloadToken}`;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    listCustomerFaqs({ search, category })
      .then((data) => {
        if (cancelled) return;
        setOutcome({ key: requestKey, data });
        // Keep the category list stable while narrowing results
        if (!search && !category) setKnownCategories(data.categories);
      })
      .catch((error: unknown) => {
        if (cancelled || handleAuthError(error)) return;
        setOutcome({
          key: requestKey,
          error:
            error instanceof Error ? error.message : "Could not load help articles.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [search, category, requestKey, handleAuthError]);

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSearch(value.trim()), SEARCH_DEBOUNCE_MS);
  }

  const loading = outcome?.key !== requestKey;
  const data = outcome?.data;
  const error = !loading ? outcome?.error : undefined;
  const filtered = Boolean(search || category);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-[#6D5EF5]/10 text-[#6D5EF5] flex items-center justify-center">
          <span className="material-symbols-outlined text-2xl" aria-hidden="true">
            quiz
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1c1b23] leading-tight">Help center</h1>
          <p className="text-sm text-[#787586]">
            Quick answers to common questions.
          </p>
        </div>
      </div>

      <div className="bg-white border border-[#e2e4e9] rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          aria-label="Search help articles"
          placeholder="Search help articles"
          value={searchInput}
          maxLength={100}
          onChange={(event) => handleSearchChange(event.target.value)}
          className="flex-1 rounded-lg border border-[#e2e4e9] bg-white px-3 py-2 text-sm text-[#1c1b23] focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/30"
        />
        {knownCategories.length > 0 ? (
          <select
            aria-label="Category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-lg border border-[#e2e4e9] bg-white px-3 py-2 text-sm text-[#1c1b23] focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/30"
          >
            <option value="">All categories</option>
            {knownCategories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div
        className="bg-white border border-[#e2e4e9] rounded-2xl shadow-2xs overflow-hidden"
        aria-busy={loading}
      >
        {loading && !data ? (
          <div
            role="status"
            className="p-12 flex flex-col items-center gap-3 text-sm text-[#787586]"
          >
            <span className="inline-block w-6 h-6 border-2 border-[#6D5EF5]/30 border-t-[#6D5EF5] rounded-full animate-spin" aria-hidden="true" />
            Loading help articles...
          </div>
        ) : error ? (
          <div className="p-10 text-center space-y-3">
            <p role="alert" className="font-semibold text-rose-800 text-sm">
              {error}
            </p>
            <button
              type="button"
              onClick={() => setReloadToken((n) => n + 1)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : data && data.faqs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-semibold text-sm text-[#1c1b23]">
              {filtered ? "No articles match your search" : "No help articles yet"}
            </p>
          </div>
        ) : data ? (
          <ul className={`divide-y divide-[#e2e4e9] ${loading ? "opacity-60" : ""}`}>
            {data.faqs.map((faq) => (
              <li key={faq.faqId}>
                <details className="group">
                  <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-[#f6f2ff]/60">
                    <span className="text-sm font-semibold text-[#1c1b23]">
                      {faq.question}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {faq.category ? (
                        <span className="px-2 py-0.5 rounded-md bg-[#f6f2ff] text-[#6D5EF5] text-[10px] font-bold">
                          {faq.category}
                        </span>
                      ) : null}
                      <span
                        className="material-symbols-outlined text-lg text-[#787586] transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      >
                        expand_more
                      </span>
                    </span>
                  </summary>
                  <p className="px-5 pb-4 text-sm text-[#474555] whitespace-pre-wrap break-words">
                    {faq.answer}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="text-sm text-[#474555]">
        Still need help?{" "}
        <Link
          to={ROUTES.CUSTOMER_NEW_TICKET}
          className="font-semibold text-[#6D5EF5] no-underline hover:underline"
        >
          Submit a ticket
        </Link>
      </p>
    </div>
  );
}
