interface FeaturesSectionProps {
  onLearnMore?: (feature: string) => void;
}

export function FeaturesSection({ onLearnMore }: FeaturesSectionProps) {
  const features = [
    {
      badge: "99.9% Accuracy",
      icon: "smart_toy",
      title: "AI Customer Support",
      description:
        "Autonomous resolution of complex customer queries using RAG-enhanced large language models trained on your data.",
    },
    {
      badge: "Auto-Sync",
      icon: "menu_book",
      title: "Knowledge Base",
      description:
        "Self-organizing knowledge repositories that dynamically learn, ingest updates, and refine answers from every human agent resolution.",
    },
    {
      badge: "Instant Triage",
      icon: "confirmation_number",
      title: "Smart Management",
      description:
        "Intelligent multi-channel ticket triage, emotion detection, and automated urgency classification across all inbound streams.",
    },
    {
      badge: "Smart Routing",
      icon: "assignment_ind",
      title: "Auto Assignment",
      description:
        "Dynamically route escalated inquiries to the best-equipped support specialist based on domain expertise and active workload.",
    },
    {
      badge: "Real-time",
      icon: "monitoring",
      title: "Analytics Dashboard",
      description:
        "Deep, real-time visibility into customer satisfaction (CSAT), first-contact resolution speeds, and automated AI efficiency.",
    },
    {
      badge: "Global",
      icon: "hub",
      title: "Multi-Tenant Architecture",
      description:
        "Securely manage multiple client brands, localized divisions, and isolated support teams from a single centralized console.",
    },
  ];

  return (
    <section
      className="relative py-28 bg-surface-container-low overflow-hidden"
      id="features"
    >
      {/* Background Ambient Elements */}
      <div className="features-grid-pattern opacity-30 absolute inset-0 pointer-events-none" />
      <div className="features-glow-left" />
      <div className="features-glow-right" />

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16 reveal">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20 mb-4">
            <span className="text-[11px] font-bold text-primary uppercase tracking-widest">
              Core Capabilities
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-display text-on-surface mb-5 leading-tight">
            Powerful features for
            <br />
            enterprise teams
          </h2>
          <p className="text-base md:text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Scale global support operations with modern infrastructure designed
            for high-volume automation without losing human empathy.
          </p>
        </div>

        {/* Dashboard Showcase Preview */}
        <div className="mb-20 reveal">
          <div className="relative max-w-5xl mx-auto hover-scale">
            <div className="absolute -inset-4 bg-primary/15 blur-2xl rounded-[2.5rem] opacity-60" />
            <div className="relative glass p-2.5 sm:p-3.5 rounded-[2.2rem] border border-white/50 shadow-2xl bg-white/40 backdrop-blur-xl">
              <img
                alt="SupportPilot Dashboard Preview"
                className="w-full h-auto rounded-[1.8rem] shadow-md object-cover"
                src="/landing/dashboard-preview.png"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://lh3.googleusercontent.com/aida-public/AB6AXuDIHQMllcLDUyuC_xcSZ93_bsMdx7_H6knpxe1yz77SIcDJQ_q48NrogcZ8ifurdAHeuBdl5dlbrTn8xLeLI82x5Qz8Wp7qGEByQoGrRbnrq0b727S-h2At--IiNFjQAoEL7w7km0ZWKhKWRzo7fWS4Vw12lzi1ZjVKnHJxQhN7ZBKS6xFT51T5CODQ3ldBEHSWwQ_-O10Nqp6yrJBGSfDYMiDCOl5o_emynNlg9ooAYloRVtUfLu8I";
                }}
              />
            </div>
          </div>
        </div>

        {/* 6 Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, idx) => (
            <div
              key={feature.title}
              className="reveal p-8 rounded-3xl glass border border-white/50 hover-scale group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 bg-white/70 backdrop-blur-lg flex flex-col justify-between"
              style={{ transitionDelay: `${idx * 80}ms` }}
            >
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary-container text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-3xl">
                      {feature.icon}
                    </span>
                  </div>
                  <span className="bg-primary/10 text-primary text-[11px] font-bold px-3 py-1 rounded-full border border-primary/20">
                    {feature.badge}
                  </span>
                </div>

                <h3 className="text-xl font-bold mb-3 text-on-surface">
                  {feature.title}
                </h3>
                <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
                  {feature.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onLearnMore?.(feature.title)}
                className="inline-flex items-center gap-1.5 text-primary font-bold text-sm hover:gap-2.5 transition-all text-left group-hover:underline"
              >
                <span>Learn More</span>
                <span className="material-symbols-outlined text-base">
                  chevron_right
                </span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

