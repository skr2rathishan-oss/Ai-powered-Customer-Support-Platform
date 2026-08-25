import { Link } from "react-router";
import { ROUTES } from "../../router/routes";

interface CtaBannerProps {
  onBookDemo?: () => void;
}

export function CtaBanner({ onBookDemo }: CtaBannerProps) {
  return (
    <section className="py-16 bg-surface-container-low px-6">
      <div className="max-w-5xl mx-auto bg-gradient-to-r from-primary/10 via-primary/5 to-primary/15 border border-primary/25 rounded-3xl p-10 sm:p-16 text-center reveal glass backdrop-blur-2xl shadow-xl shadow-primary/5">
        <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20 mb-5">
          <span className="text-[11px] font-bold text-primary uppercase tracking-widest">
            Transform Your Support
          </span>
        </div>

        <h3 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-display text-on-surface mb-4">
          Ready to get started?
        </h3>
        <p className="text-base md:text-lg text-on-surface-variant max-w-2xl mx-auto mb-10 leading-relaxed">
          Deliver exceptional support resolution in seconds. Book a live
          interactive demo or start your 14-day free trial today.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            to={ROUTES.REGISTER_COMPANY}
            className="magnetic-btn w-full sm:w-auto bg-primary hover:bg-primary-container text-white px-10 py-4 rounded-xl text-base font-bold shadow-xl shadow-primary/30 transition-all text-center flex items-center justify-center gap-2"
          >
            <span>Start Free Trial</span>
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </Link>
          <button
            type="button"
            onClick={onBookDemo}
            className="magnetic-btn w-full sm:w-auto glass px-10 py-4 rounded-xl text-base font-bold text-on-surface hover:bg-white/80 transition-all border border-white/60 shadow-md text-center"
          >
            Book a Demo
          </button>
        </div>
      </div>
    </section>
  );
}

