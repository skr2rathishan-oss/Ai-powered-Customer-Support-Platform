import { useEffect } from "react";
import { Link } from "react-router";
import { ROUTES } from "../../router/routes";

type LegalKind = "terms" | "privacy";

interface Section {
  heading: string;
  body: string;
}

interface LegalDocument {
  title: string;
  intro: string;
  sections: Section[];
}

const LAST_UPDATED = "October 2026";

const DOCUMENTS: Record<LegalKind, LegalDocument> = {
  terms: {
    title: "Terms of Service",
    intro:
      "These terms describe how SupportPilot may be used. This is a placeholder summary and will be replaced by the final legal text before launch.",
    sections: [
      {
        heading: "Using SupportPilot",
        body: "You may use SupportPilot to manage customer support for your own business or to request support from a company that uses it. You are responsible for the accuracy of the information you provide and for keeping your sign-in details private.",
      },
      {
        heading: "Accounts and access",
        body: "Company administrators control who in their company can access the workspace. Accounts that are deactivated lose access to their workspace until they are reactivated.",
      },
      {
        heading: "Acceptable use",
        body: "Do not use the service to send unlawful, abusive or misleading content, to attempt to access another company's data, or to interfere with the platform.",
      },
      {
        heading: "Changes",
        body: "We may update these terms as the product evolves. Continued use after an update means you accept the revised terms.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro:
      "This page summarises how SupportPilot handles personal information. It is a placeholder and will be replaced by the final policy before launch.",
    sections: [
      {
        heading: "What we collect",
        body: "Account details such as your name, email address and role, the support tickets and messages you submit, and basic technical data needed to keep the service secure.",
      },
      {
        heading: "How it is used",
        body: "To run your workspace, route and answer support requests, send service emails such as password resets, and protect the platform against abuse.",
      },
      {
        heading: "Sign-in and security",
        body: "Passwords are stored as one-way hashes and sessions use secure cookies. If you sign in with Google, we only use your verified email address to match an existing SupportPilot account.",
      },
      {
        heading: "Your choices",
        body: "Contact your company administrator or the SupportPilot team to request access to, correction of, or removal of your information.",
      },
    ],
  },
};

export function LegalPage({ kind }: { kind: LegalKind }) {
  const document_ = DOCUMENTS[kind];

  useEffect(() => {
    const previous = document.title;
    document.title = `${document_.title} | SupportPilot`;
    return () => {
      document.title = previous;
    };
  }, [document_.title]);

  return (
    <main className="min-h-screen bg-[#f8f9fc] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <Link
          to={ROUTES.HOME}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary no-underline mb-6"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to home
        </Link>
        <article className="bg-white p-8 rounded-2xl border border-outline-variant shadow-lg">
          <h1 className="text-2xl font-bold text-on-surface mb-1 font-display">
            {document_.title}
          </h1>
          <p className="text-xs text-outline mb-4">Last updated: {LAST_UPDATED}</p>
          <p className="text-sm text-outline leading-relaxed mb-6">
            {document_.intro}
          </p>
          {document_.sections.map((section) => (
            <section key={section.heading} className="mb-5">
              <h2 className="text-base font-bold text-on-surface mb-1 font-display">
                {section.heading}
              </h2>
              <p className="text-sm text-outline leading-relaxed">{section.body}</p>
            </section>
          ))}
          <div className="flex gap-4 text-xs pt-4 border-t border-outline-variant">
            <Link to={ROUTES.TERMS} className="text-primary no-underline">
              Terms of Service
            </Link>
            <Link to={ROUTES.PRIVACY} className="text-primary no-underline">
              Privacy Policy
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
