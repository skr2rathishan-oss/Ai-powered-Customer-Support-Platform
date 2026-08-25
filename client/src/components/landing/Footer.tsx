import { useState } from "react";
import { Link } from "react-router";
import { subscribeNewsletter } from "../../services/leads";
import { ROUTES } from "../../router/routes";

export function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  async function handleNewsletterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setStatus("error");
      setStatusMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    try {
      const res = await subscribeNewsletter({ email: email.trim() });
      setStatus("success");
      setStatusMessage(res.message ?? "Thank you for subscribing!");
      setEmail("");
    } catch {
      setStatus("error");
      setStatusMessage("Subscription failed. Please try again.");
    }
  }

  return (
    <footer className="bg-on-surface text-surface pt-20 pb-12">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-5 gap-10 md:gap-12 mb-16">
        {/* Brand Column */}
        <div className="col-span-2">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-lg">
                flight_takeoff
              </span>
            </div>
            <span className="font-bold text-xl tracking-tight text-white">
              SupportPilot
            </span>
          </div>

          <p className="text-white/70 max-w-sm text-sm leading-relaxed mb-6">
            The enterprise-grade platform for modern, human-centric, AI-powered
            customer support operations.
          </p>

          {/* Social Icons */}
          <div className="flex gap-3 mb-8">
            <a
              href="#hero"
              aria-label="SupportPilot Web"
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors text-white"
            >
              <span className="material-symbols-outlined text-sm">public</span>
            </a>
            <a
              href="#faq"
              aria-label="SupportPilot Community"
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors text-white"
            >
              <span className="material-symbols-outlined text-sm">forum</span>
            </a>
            <a
              href="#pricing"
              aria-label="Share SupportPilot"
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors text-white"
            >
              <span className="material-symbols-outlined text-sm">share</span>
            </a>
          </div>

          {/* Newsletter Box */}
          <div className="max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">
              Stay updated on AI releases
            </p>
            <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
              <input
                type="email"
                placeholder="work@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status !== "idle") setStatus("idle");
                }}
                disabled={status === "loading"}
                className="bg-white/10 border border-white/20 text-white placeholder-white/40 text-xs px-3.5 py-2 rounded-lg focus:outline-none focus:border-primary flex-grow"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="bg-primary hover:bg-primary-container text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0"
              >
                {status === "loading" ? "…" : "Subscribe"}
              </button>
            </form>
            {statusMessage && (
              <p
                className={`text-[11px] mt-1.5 ${
                  status === "success" ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {statusMessage}
              </p>
            )}
          </div>
        </div>

        {/* Product Column */}
        <div>
          <h5 className="font-bold text-sm text-white mb-6 uppercase tracking-wider">
            Product
          </h5>
          <ul className="space-y-3.5 text-sm text-white/70">
            <li>
              <a className="hover:text-primary transition-colors" href="#features">
                Features
              </a>
            </li>
            <li>
              <a className="hover:text-primary transition-colors" href="#solutions">
                Solutions
              </a>
            </li>
            <li>
              <a className="hover:text-primary transition-colors" href="#pricing">
                Pricing
              </a>
            </li>
            <li>
              <Link
                className="hover:text-primary transition-colors"
                to={ROUTES.REGISTER_COMPANY}
              >
                Free Trial
              </Link>
            </li>
          </ul>
        </div>

        {/* Resources Column */}
        <div>
          <h5 className="font-bold text-sm text-white mb-6 uppercase tracking-wider">
            Resources
          </h5>
          <ul className="space-y-3.5 text-sm text-white/70">
            <li>
              <a className="hover:text-primary transition-colors" href="#faq">
                Help Center
              </a>
            </li>
            <li>
              <a className="hover:text-primary transition-colors" href="#faq">
                FAQ
              </a>
            </li>
            <li>
              <a className="hover:text-primary transition-colors" href="#hero">
                API Docs
              </a>
            </li>
            <li>
              <Link className="hover:text-primary transition-colors" to={ROUTES.LOGIN}>
                Account Portal
              </Link>
            </li>
          </ul>
        </div>

        {/* Company Column */}
        <div>
          <h5 className="font-bold text-sm text-white mb-6 uppercase tracking-wider">
            Company
          </h5>
          <ul className="space-y-3.5 text-sm text-white/70">
            <li>
              <a className="hover:text-primary transition-colors" href="#hero">
                About Us
              </a>
            </li>
            <li>
              <a className="hover:text-primary transition-colors" href="#pricing">
                Enterprise
              </a>
            </li>
            <li>
              <Link
                className="hover:text-primary transition-colors"
                to={ROUTES.REGISTER_COMPANY}
              >
                Join SupportPilot
              </Link>
            </li>
            <li>
              <Link className="hover:text-primary transition-colors" to={ROUTES.LOGIN}>
                Sign In
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="max-w-6xl mx-auto px-6 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between text-xs text-white/50 gap-4">
        <p>© 2026 SupportPilot AI Inc. All rights reserved.</p>
        <div className="flex gap-6">
          <a className="hover:text-white transition-colors" href="#hero">
            Terms of Service
          </a>
          <a className="hover:text-white transition-colors" href="#hero">
            Privacy Policy
          </a>
          <a className="hover:text-white transition-colors" href="#hero">
            Security
          </a>
          <a className="hover:text-white transition-colors" href="#hero">
            Status
          </a>
        </div>
      </div>
    </footer>
  );
}

