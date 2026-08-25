import { Link } from "react-router";
import { ROUTES } from "../../router/routes";

interface PricingSectionProps {
  onContactSales?: () => void;
}

export function PricingSection({ onContactSales }: PricingSectionProps) {
  return (
    <section className="py-28 bg-surface-container-low" id="pricing">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 reveal">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20 mb-4">
            <span className="text-[11px] font-bold text-primary uppercase tracking-widest">
              Transparent Plans
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-display text-on-surface mb-4">
            Simple, Scalable Pricing
          </h2>
          <p className="text-base md:text-lg text-on-surface-variant max-w-xl mx-auto">
            Choose the plan that fits your current support volume and scale
            seamlessly as your customer base expands.
          </p>
        </div>

        {/* 3 Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
          {/* 1. Starter Plan */}
          <div className="reveal p-8 rounded-3xl bg-white border border-outline-variant/60 flex flex-col justify-between hover-scale transition-all duration-300 hover:shadow-xl shadow-sm">
            <div>
              <h3 className="font-bold text-2xl mb-1 text-on-surface">Starter</h3>
              <p className="text-on-surface-variant text-sm mb-6">
                For fast-growing startups & teams
              </p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-5xl font-extrabold text-on-surface">$49</span>
                <span className="text-on-surface-variant font-medium">/month</span>
              </div>
              <ul className="space-y-4 mb-8 text-sm">
                <li className="flex items-center gap-3 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-base">
                    check_circle
                  </span>
                  <span>Up to 1,000 automated tickets/mo</span>
                </li>
                <li className="flex items-center gap-3 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-base">
                    check_circle
                  </span>
                  <span>Basic AI agent resolution</span>
                </li>
                <li className="flex items-center gap-3 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-base">
                    check_circle
                  </span>
                  <span>Email & chat integrations</span>
                </li>
                <li className="flex items-center gap-3 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-base">
                    check_circle
                  </span>
                  <span>Standard 48-hour response support</span>
                </li>
              </ul>
            </div>
            <Link
              to={ROUTES.REGISTER_COMPANY}
              className="magnetic-btn w-full text-center py-3.5 rounded-xl border-2 border-primary text-primary font-bold hover:bg-primary/5 transition-all text-sm block"
            >
              Start Free Trial
            </Link>
          </div>

          {/* 2. Professional Plan (Spotlight / Featured) */}
          <div
            className="reveal p-8 rounded-3xl bg-on-surface text-white relative shadow-2xl scale-100 md:scale-105 z-10 hover-scale transition-all duration-300 flex flex-col justify-between border border-primary/40"
            style={{ transitionDelay: "100ms" }}
          >
            {/* Most Popular Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-primary/40">
              Most Popular
            </div>

            <div>
              <h3 className="font-bold text-2xl mb-1 text-white">Professional</h3>
              <p className="text-white/70 text-sm mb-6">
                For scaling global support centers
              </p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-5xl font-extrabold text-white">$199</span>
                <span className="text-white/70 font-medium">/month</span>
              </div>
              <ul className="space-y-4 mb-8 text-sm">
                <li className="flex items-center gap-3 text-white">
                  <span className="material-symbols-outlined text-primary-soft text-base">
                    check_circle
                  </span>
                  <span>Unlimited automated tickets</span>
                </li>
                <li className="flex items-center gap-3 text-white">
                  <span className="material-symbols-outlined text-primary-soft text-base">
                    check_circle
                  </span>
                  <span>Advanced RAG AI with live sync</span>
                </li>
                <li className="flex items-center gap-3 text-white">
                  <span className="material-symbols-outlined text-primary-soft text-base">
                    check_circle
                  </span>
                  <span>Multi-language support (95+ locales)</span>
                </li>
                <li className="flex items-center gap-3 text-white">
                  <span className="material-symbols-outlined text-primary-soft text-base">
                    check_circle
                  </span>
                  <span>Custom analytics & CSAT reports</span>
                </li>
                <li className="flex items-center gap-3 text-white">
                  <span className="material-symbols-outlined text-primary-soft text-base">
                    check_circle
                  </span>
                  <span>Priority 24/7 dedicated support</span>
                </li>
              </ul>
            </div>
            <Link
              to={ROUTES.REGISTER_COMPANY}
              className="magnetic-btn w-full text-center py-3.5 rounded-xl bg-primary hover:bg-primary-container text-white font-bold shadow-lg shadow-primary/30 transition-all text-sm block"
            >
              Get Started Now
            </Link>
          </div>

          {/* 3. Enterprise Plan */}
          <div
            className="reveal p-8 rounded-3xl bg-white border border-outline-variant/60 flex flex-col justify-between hover-scale transition-all duration-300 hover:shadow-xl shadow-sm"
            style={{ transitionDelay: "200ms" }}
          >
            <div>
              <h3 className="font-bold text-2xl mb-1 text-on-surface">Enterprise</h3>
              <p className="text-on-surface-variant text-sm mb-6">
                For custom requirements & security
              </p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-5xl font-extrabold text-on-surface">Custom</span>
              </div>
              <ul className="space-y-4 mb-8 text-sm">
                <li className="flex items-center gap-3 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-base">
                    check_circle
                  </span>
                  <span>Custom LLM fine-tuning & on-premise</span>
                </li>
                <li className="flex items-center gap-3 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-base">
                    check_circle
                  </span>
                  <span>Dedicated Account Manager & Architect</span>
                </li>
                <li className="flex items-center gap-3 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-base">
                    check_circle
                  </span>
                  <span>SOC2 Type II, HIPAA & custom SLA</span>
                </li>
                <li className="flex items-center gap-3 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-base">
                    check_circle
                  </span>
                  <span>50+ custom ERP & CRM integrations</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              onClick={onContactSales}
              className="magnetic-btn w-full text-center py-3.5 rounded-xl border-2 border-outline-variant text-on-surface font-bold hover:bg-surface-container transition-all text-sm"
            >
              Contact Sales
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

