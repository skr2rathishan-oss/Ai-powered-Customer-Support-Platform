import { Link } from "react-router";
import { ROUTES } from "../../router/routes";

interface HeroSectionProps {
  onWatchDemo: (title?: string) => void;
}

export function HeroSection({ onWatchDemo }: HeroSectionProps) {
  return (
    <section
      className="relative min-h-[95vh] flex flex-col items-center justify-center pt-36 pb-20 overflow-hidden"
      id="hero"
    >
      {/* Aurora Ambient Glows */}
      <div className="absolute inset-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="hero-aurora-glow-1" />
        <div className="hero-aurora-glow-2" />
        <div className="hero-aurora-glow-3" />
        <div className="hero-grid-pattern opacity-40 absolute inset-0" />
      </div>

      <div className="max-w-4xl mx-auto px-6 text-center z-10">
        {/* Enterprise Pill Badge */}
        <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20 mb-8 reveal">
          <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] font-bold text-primary uppercase tracking-widest">
            Enterprise AI Support
          </span>
        </div>

        {/* Hero Title */}
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-on-surface leading-[1.12] mb-6 reveal font-display"
          style={{ transitionDelay: "100ms" }}
        >
          Customer support powered by
          <br />
          <span className="text-primary italic">human-centric</span> AI.
        </h1>

        {/* Subtitle */}
        <p
          className="text-lg md:text-xl text-on-surface-variant max-w-2xl mx-auto mb-10 leading-relaxed reveal"
          style={{ transitionDelay: "200ms" }}
        >
          Automate 80% of your support volume while maintaining deep, personal
          connections with every customer interaction.
        </p>

        {/* Call to Actions */}
        <div
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16 reveal"
          style={{ transitionDelay: "300ms" }}
        >
          <Link
            to={ROUTES.REGISTER_COMPANY}
            className="magnetic-btn w-full sm:w-auto bg-on-surface text-white px-9 py-4 rounded-xl text-base font-bold hover:bg-black/90 transition-all shadow-xl shadow-on-surface/10 flex items-center justify-center gap-2"
          >
            <span>Start Free Trial</span>
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </Link>
          <button
            type="button"
            onClick={() => onWatchDemo("SupportPilot Platform Overview")}
            className="magnetic-btn w-full sm:w-auto glass px-9 py-4 rounded-xl text-base font-bold text-on-surface hover:bg-white/80 transition-all flex items-center justify-center gap-2 border border-white/60 shadow-lg shadow-primary/5"
          >
            <span className="material-symbols-outlined text-primary text-2xl">
              play_circle
            </span>
            <span>Watch Demo</span>
          </button>
        </div>

        {/* Interactive Video Showcase Cards */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-5xl mx-auto reveal"
          style={{ transitionDelay: "400ms" }}
        >
          {/* Card 1: Platform Overview */}
          <div
            onClick={() => onWatchDemo("SupportPilot Platform Overview (2:30)")}
            className="group relative rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 hover-scale cursor-pointer border border-white/50 bg-white"
          >
            <img
              alt="Platform Overview"
              className="w-full aspect-video object-cover transition-transform duration-700 group-hover:scale-105"
              src="/landing/hero-card-1.jpg"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://lh3.googleusercontent.com/aida-public/AB6AXuC5nh5_4Wvv3oPjP-QDuYuT_13CUo1hrgU_J4L3IAakN6ZgjWe6pAaMJ9Z0Z22yTqa7Xx8Bd9ba3nVtgqE5Y8714BWPHhdX83Xt50_14xTMmzkym7FhuiYqb6ymhbEibjKY_Fz740p0N3XpA-3xIQBja_lXGbnmc40Z7USI2fXI1HMS0pE71jmf33-5jpbYfKDhd8HlrNxFojpI47HImfmTxA5I2SsydnQFhXJlTxKVhJW4kdSXfmg6";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-end p-6">
              <div className="flex justify-between items-end">
                <div className="text-left">
                  <p className="text-white/70 text-[11px] font-bold uppercase tracking-wider mb-1">
                    Introduction
                  </p>
                  <h3 className="text-white font-bold text-lg md:text-xl">
                    Platform Overview
                  </h3>
                </div>
                <div className="bg-white/20 backdrop-blur-md px-2.5 py-1 rounded text-xs font-bold text-white mb-1">
                  2:30
                </div>
              </div>
            </div>
            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-xl scale-95 group-hover:scale-110 transition-transform duration-300">
                <span className="material-symbols-outlined text-3xl">
                  play_arrow
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: AI Support Demo */}
          <div
            onClick={() => onWatchDemo("AI Support Demo & Triage (3:15)")}
            className="group relative rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 hover-scale cursor-pointer border border-white/50 bg-white"
          >
            <img
              alt="AI Demo"
              className="w-full aspect-video object-cover transition-transform duration-700 group-hover:scale-105"
              src="/landing/hero-card-2.jpg"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://lh3.googleusercontent.com/aida-public/AB6AXuDlFsOfCBSRmPrmnkezyKJKyQJAqYbPlVdLyfc0fx9SUhMrDHijYKMMDFjkCPArkKAZKE6gavu6O8UQp88b1sPXw3cRIwm6fQ3PddnEpr1E9ll-pWwhLcnFssinlxT38RGseZVDmzjhaGA9M6tqNF60nkwMqYKpR2WUHxceYxVWWq3rRWHRo_WWCpGOfcfXaRl426TkLECMSWTdn83tm4E3WVWKBbC_2iPSX7ROUNb8pwNy7CDxbnnV";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-end p-6">
              <div className="flex justify-between items-end">
                <div className="text-left">
                  <p className="text-white/70 text-[11px] font-bold uppercase tracking-wider mb-1">
                    Live Case Study
                  </p>
                  <h3 className="text-white font-bold text-lg md:text-xl">
                    AI Support Demo
                  </h3>
                </div>
                <div className="bg-white/20 backdrop-blur-md px-2.5 py-1 rounded text-xs font-bold text-white mb-1">
                  3:15
                </div>
              </div>
            </div>
            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-xl scale-95 group-hover:scale-110 transition-transform duration-300">
                <span className="material-symbols-outlined text-3xl">
                  play_arrow
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

