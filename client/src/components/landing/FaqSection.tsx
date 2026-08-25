import { useState } from "react";

interface FaqSectionProps {
  onContactSales?: () => void;
  onLiveChat?: () => void;
}

export function FaqSection({ onContactSales, onLiveChat }: FaqSectionProps) {
  const [activeCategory, setActiveCategory] = useState<string>("security");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const categories = [
    { id: "security", label: "Security" },
    { id: "ai", label: "AI Capabilities" },
    { id: "integrations", label: "Integrations" },
    { id: "pricing", label: "Pricing & Billing" },
    { id: "support", label: "Support & SLA" },
  ];

  const faqData: Record<
    string,
    Array<{ q: string; a: string; icon: string }>
  > = {
    security: [
      {
        q: "How secure is my customer and enterprise data?",
        a: "SupportPilot is fully SOC2 Type II and GDPR compliant. All data is encrypted using AES-256 at rest and TLS 1.3 in transit. Crucially, your private data and customer conversations are never used to train global base models for other organizations.",
        icon: "shield",
      },
      {
        q: "Where is our data stored and hosted?",
        a: "We offer regional data residency across the US, EU, and APAC. Enterprise plans can also deploy SupportPilot in private VPCs or on-premise Kubernetes clusters.",
        icon: "lock",
      },
      {
        q: "Do you support Single Sign-On (SSO) and Role-Based Access?",
        a: "Yes, we support SAML 2.0, Okta, Google Workspace, Azure AD, and granular role-based permissions (Admin, Support Lead, Agent, Read-Only).",
        icon: "key",
      },
    ],
    ai: [
      {
        q: "What happens if the AI cannot confidently answer a customer question?",
        a: "SupportPilot uses an intelligent confidence threshold. If a query falls below 95% certainty, it automatically triages and escalates the ticket to your human support team with a summarized context and proposed response draft.",
        icon: "smart_toy",
      },
      {
        q: "How does the Knowledge Base stay up-to-date?",
        a: "Our Auto-Sync engine connects to your Notion, Confluence, Zendesk Guide, or website docs. Whenever human agents resolve an escalation, the AI suggests knowledge base improvements automatically.",
        icon: "sync",
      },
      {
        q: "Does SupportPilot support multi-turn complex conversations?",
        a: "Yes. Our conversational engine maintains state, tracks customer sentiment, verifies user credentials securely, and can execute actions via API webhooks (like order tracking or refund status).",
        icon: "forum",
      },
    ],
    integrations: [
      {
        q: "Can SupportPilot integrate with Zendesk, Salesforce, or Intercom?",
        a: "Yes, we have 50+ one-click integrations including Zendesk, Salesforce Service Cloud, Intercom, HubSpot, Freshdesk, Jira, and Slack.",
        icon: "hub",
      },
      {
        q: "Is there a REST API and Webhook system for custom apps?",
        a: "SupportPilot exposes comprehensive OpenAPI-compliant REST endpoints and real-time event webhooks for seamless custom platform integration.",
        icon: "api",
      },
    ],
    pricing: [
      {
        q: "Is there a free trial available?",
        a: "Yes, we offer a 14-day free trial on all plans with full access to AI agents, knowledge base syncing, and multi-channel inbox features without requiring a credit card.",
        icon: "redeem",
      },
      {
        q: "What counts towards automated ticket volume?",
        a: "Only tickets that receive AI-generated resolutions count towards volume. Inquiries routed directly to human agents without AI interaction do not consume your monthly AI quota.",
        icon: "receipt_long",
      },
    ],
    support: [
      {
        q: "What support channels and response times do you provide?",
        a: "Starter plans include email support within 48 hours. Professional plans include 24/7 priority chat support (< 30 minutes response time). Enterprise tiers receive a dedicated Slack channel and 99.99% uptime SLA.",
        icon: "headset_mic",
      },
      {
        q: "How long does onboarding and rollout take?",
        a: "Standard setups take under 15 minutes by uploading your knowledge base. Enterprise custom fine-tuning and ERP workflows typically deploy in 1-2 weeks.",
        icon: "rocket_launch",
      },
    ],
  };

  const currentQuestions = faqData[activeCategory] ?? faqData.security;

  return (
    <section className="py-28 relative overflow-hidden bg-surface-container-low" id="faq">
      <div className="features-grid-pattern opacity-25 absolute inset-0 pointer-events-none" />
      <div className="faq-glow-top" />
      <div className="faq-glow-bottom" />

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-16 reveal">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20 mb-4">
            <span className="text-[11px] font-bold text-primary uppercase tracking-widest">
              Got Questions?
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-display text-on-surface mb-4 leading-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-base md:text-lg text-on-surface-variant max-w-2xl mx-auto">
            Everything you need to know about SupportPilot, AI safety, and how
            it integrates with your stack.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Direct Channels Card */}
          <div className="lg:col-span-5 reveal">
            <div className="glass p-8 rounded-3xl border border-white/50 shadow-xl shadow-primary/5 bg-white/75 backdrop-blur-xl relative overflow-hidden">
              <img
                alt="AI Assistant"
                className="w-full h-auto rounded-2xl mb-8 object-cover shadow-sm bg-white"
                src="/landing/faq-assistant.png"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://lh3.googleusercontent.com/aida/AP1WRLsZjWboK3lP_jadxHXyry5FO94B9mpFmJRflM7As5ZAHgHbqNYehafxsOV_Imrizf_btLeY3z0zYlde2h15TPjvWnGNjIT0L_fFA0gpQPqQl82zQ_mCN7djayTDvRiSNUr-eEvud7eTgsnNhqYIMjLoiVsmAkDB3c2FXZPRs8jSZb9Hz-E9B7JbXBmIHsfhfM8nCrmNGnfdKwX2Ll0vabPZCn91zTVP6aMy4dj9YaV_9p8P0R4visD7-mo";
                }}
              />
              <h3 className="text-2xl font-bold mb-2 text-on-surface font-display">
                Still have questions?
              </h3>
              <p className="text-on-surface-variant text-sm mb-6">
                Our customer solutions team is available 24/7 to answer your
                technical and business questions.
              </p>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={onContactSales}
                  className="w-full flex items-center gap-3.5 p-3.5 rounded-xl hover:bg-white/80 transition-colors group border border-transparent hover:border-white/50 shadow-xs text-left"
                >
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-xl">
                      headset_mic
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-sm text-on-surface block group-hover:text-primary transition-colors">
                      Contact Sales
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      Talk with an enterprise specialist
                    </span>
                  </div>
                </button>

                <a
                  href="#features"
                  className="w-full flex items-center gap-3.5 p-3.5 rounded-xl hover:bg-white/80 transition-colors group border border-transparent hover:border-white/50 shadow-xs text-left"
                >
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-xl">
                      description
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-sm text-on-surface block group-hover:text-primary transition-colors">
                      Documentation & API
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      Explore our developer guides
                    </span>
                  </div>
                </a>

                <button
                  type="button"
                  onClick={onLiveChat}
                  className="w-full flex items-center gap-3.5 p-3.5 rounded-xl hover:bg-white/80 transition-colors group border border-transparent hover:border-white/50 shadow-xs text-left"
                >
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-xl">
                      chat
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-sm text-on-surface block group-hover:text-primary transition-colors">
                      Live Chat
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      Ask our AI pilot right now
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Category Tabs & Accordion */}
          <div className="lg:col-span-7 reveal" style={{ transitionDelay: "100ms" }}>
            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2 mb-8 border-b border-outline-variant/30 pb-4">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setOpenIndex(0);
                  }}
                  className={`px-4 py-2 rounded-full font-bold text-xs transition-all ${
                    activeCategory === cat.id
                      ? "bg-primary text-white shadow-sm"
                      : "text-on-surface-variant hover:text-primary hover:bg-primary/5"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Accordion List */}
            <div className="space-y-4">
              {currentQuestions.map((item, idx) => {
                const isOpen = openIndex === idx;
                return (
                  <div
                    key={item.q}
                    className="glass rounded-2xl border border-white/50 overflow-hidden shadow-sm bg-white/70 backdrop-blur-md transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenIndex(isOpen ? null : idx)}
                      className="w-full p-6 flex justify-between items-center text-left hover:bg-white/40 transition-colors"
                      aria-expanded={isOpen}
                    >
                      <div className="flex items-center gap-3.5 pr-4">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-sm">
                            {item.icon}
                          </span>
                        </div>
                        <span className="font-bold text-on-surface text-base md:text-lg">
                          {item.q}
                        </span>
                      </div>
                      <span
                        className={`material-symbols-outlined text-on-surface-variant transition-transform duration-300 shrink-0 ${
                          isOpen ? "rotate-180 text-primary" : ""
                        }`}
                      >
                        expand_more
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-6 pl-16 text-on-surface-variant text-sm md:text-base leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

