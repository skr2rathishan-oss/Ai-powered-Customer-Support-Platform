import { useState } from "react";
import { Link } from "react-router";
import { ROUTES } from "../../router/routes";

interface SolutionsSectionProps {
  onOpenDemo?: (industry?: string) => void;
}

export function SolutionsSection({ onOpenDemo }: SolutionsSectionProps) {
  const [activeTab, setActiveTab] = useState<string>("saas");

  const tabs = [
    { id: "saas", label: "SaaS" },
    { id: "ecommerce", label: "E-Commerce" },
    { id: "healthcare", label: "Healthcare" },
    { id: "education", label: "Education" },
    { id: "smallbusiness", label: "Small Business" },
    { id: "enterprise", label: "Enterprise" },
  ];

  const solutionsData: Record<
    string,
    {
      title: string;
      icon: string;
      image: string;
      imageFallback: string;
      bullets: string[];
      badges: string[];
      cta: string;
    }
  > = {
    saas: {
      title: "SaaS Support",
      icon: "cloud",
      image: "/landing/solution-saas.jpg",
      imageFallback:
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
      bullets: [
        "Predictive Churn Analysis & Risk Scoring",
        "API & Webhook Health Monitoring Integration",
        "Advanced RAG Engineering Knowledge Base",
      ],
      badges: ["+45% Retention", "80% Auto-resolve"],
      cta: "Explore SaaS Solution",
    },
    ecommerce: {
      title: "E-Commerce Ready",
      icon: "shopping_cart",
      image: "/landing/solution-ecommerce.jpg",
      imageFallback:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
      bullets: [
        "Real-time Shopify & Order Tracking Integration",
        "Automated Returns & Exchange Processing",
        "Multi-lingual Sentiment Analysis Engine",
      ],
      badges: ["2x Faster Responses", "+20% CSAT"],
      cta: "Explore E-Commerce Solution",
    },
    healthcare: {
      title: "Healthcare Solutions",
      icon: "medical_services",
      image: "/landing/solution-healthcare.jpg",
      imageFallback:
        "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80",
      bullets: [
        "HIPAA & GDPR Compliant Encrypted Architecture",
        "Intelligent Clinical Inquiry & Patient Triage",
        "Secure Appointment & Consultation Scheduling",
      ],
      badges: ["100% Secure", "30% Time Saved"],
      cta: "Explore Healthcare Solution",
    },
    education: {
      title: "Education Portals",
      icon: "school",
      image: "/landing/solution-education.jpg",
      imageFallback:
        "https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&w=1200&q=80",
      bullets: [
        "Student Admission & Course Inquiry Management",
        "LMS (Canvas/Blackboard) Integration Ready",
        "Multi-language Support for International Students",
      ],
      badges: ["24/7 Availability", "95+ Languages"],
      cta: "Explore Education Solution",
    },
    smallbusiness: {
      title: "Small Business Scaling",
      icon: "storefront",
      image: "/landing/solution-smallbusiness.jpg",
      imageFallback:
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
      bullets: [
        "Omnichannel Inbox (Email, WhatsApp, Chat)",
        "Instant Automated FAQ & Order Resolution",
        "5-Minute Self-Serve Setup with Zero Code",
      ],
      badges: ["Works Out of Box", "Zero Overhead"],
      cta: "Explore SMB Solution",
    },
    enterprise: {
      title: "Global Enterprise",
      icon: "domain",
      image: "/landing/solution-enterprise.jpg",
      imageFallback:
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
      bullets: [
        "Custom Fine-tuned LLM Models & Private Deployment",
        "Dedicated Account Management & Priority Engineering",
        "SOC2 Type II, ISO27001 & 99.99% Uptime SLA",
      ],
      badges: ["SOC2 Certified", "99.99% Uptime SLA"],
      cta: "Contact Enterprise Sales",
    },
  };

  const current = solutionsData[activeTab] ?? solutionsData.saas;

  return (
    <section
      className="relative py-28 bg-background overflow-hidden"
      id="solutions"
    >
      <div className="features-grid-pattern opacity-25 absolute inset-0 pointer-events-none" />
      <div className="solutions-glow-top" />
      <div className="solutions-glow-bottom" />

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-12 reveal">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20 mb-4">
            <span className="text-[11px] font-bold text-primary uppercase tracking-widest">
              Industry Verticals
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-display text-on-surface mb-4">
            Tailored for your industry
          </h2>
          <p className="text-base md:text-lg text-on-surface-variant max-w-2xl mx-auto">
            SupportPilot adapts to the unique workflows, terminology, and
            compliance requirements of your vertical.
          </p>
        </div>

        {/* Industry Switcher Tab Pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-14 reveal border-b border-outline-variant/30 pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-white shadow-md shadow-primary/25 scale-105"
                  : "text-on-surface-variant hover:text-primary hover:bg-primary/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dynamic Solution Showcase Card */}
        <div className="relative min-h-[460px] reveal">
          <div
            key={activeTab}
            className="flex flex-col lg:flex-row gap-10 items-center animate-in fade-in zoom-in-95 duration-400"
          >
            {/* Screenshot Column */}
            <div className="w-full lg:w-3/5">
              <div className="relative hover-scale">
                <div className="absolute -inset-4 bg-primary/15 blur-xl rounded-2xl opacity-60" />
                <img
                  alt={current.title}
                  className="w-full h-80 sm:h-96 object-cover rounded-2xl shadow-2xl relative z-10 border border-white/40 bg-white"
                  src={current.image}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = current.imageFallback;
                  }}
                />
              </div>
            </div>

            {/* Details Card Column */}
            <div className="w-full lg:w-2/5">
              <div className="glass-card p-8 rounded-3xl shadow-xl shadow-primary/5 border border-white/50 bg-white/70 backdrop-blur-xl">
                <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary-container text-white rounded-2xl flex items-center justify-center mb-6 shadow-md shadow-primary/20">
                  <span className="material-symbols-outlined text-3xl">
                    {current.icon}
                  </span>
                </div>

                <h3 className="text-2xl font-bold mb-4 text-on-surface">
                  {current.title}
                </h3>

                <ul className="space-y-3.5 mb-8">
                  {current.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-center gap-3 text-on-surface-variant text-sm font-medium"
                    >
                      <span className="material-symbols-outlined text-primary text-base">
                        check_circle
                      </span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center gap-3 mb-8">
                  {current.badges.map((badge) => (
                    <div
                      key={badge}
                      className="bg-primary/10 px-3.5 py-1 rounded-full text-xs font-bold text-primary border border-primary/20"
                    >
                      {badge}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    to={ROUTES.REGISTER_COMPANY}
                    className="magnetic-btn w-full text-center bg-primary hover:bg-primary-container text-white py-3.5 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/30 transition-all text-sm"
                  >
                    {current.cta}
                  </Link>
                  {onOpenDemo && (
                    <button
                      type="button"
                      onClick={() => onOpenDemo(current.title)}
                      className="w-full text-center glass py-3.5 rounded-xl font-bold text-on-surface hover:bg-white/80 transition-all text-sm border border-white/60"
                    >
                      Request Demo
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
