import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ROUTES } from "../../router/routes";

interface NavbarProps {
  onOpenDemo?: () => void;
}

export function Navbar({ onOpenDemo }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }

      // Scroll spy for section id
      const sections = ["features", "solutions", "pricing", "faq"];
      const scrollPosition = window.scrollY + 200;

      for (const sectionId of sections) {
        const element = document.getElementById(sectionId);
        if (element) {
          const top = element.offsetTop;
          const height = element.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(sectionId);
            break;
          }
        }
      }

      if (window.scrollY < 100) {
        setActiveSection("");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Features", href: "#features", id: "features" },
    { label: "Solutions", href: "#solutions", id: "solutions" },
    { label: "Pricing", href: "#pricing", id: "pricing" },
    { label: "Resources", href: "#faq", id: "faq" },
  ];

  return (
    <nav
      className={`fixed left-1/2 -translate-x-1/2 w-[92%] max-w-5xl z-50 transition-all duration-500 ${
        scrolled ? "top-3 md:top-4" : "top-5 md:top-6"
      }`}
      id="nav-wrapper"
    >
      <div className="glass rounded-full px-5 md:px-7 py-3 flex justify-between items-center shadow-xl shadow-primary/5 border border-white/50 backdrop-blur-xl bg-white/75">
        {/* Brand Logo */}
        <a href="#hero" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-white text-lg">flight_takeoff</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-on-surface">
            SupportPilot
          </span>
        </a>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-1" id="nav-links">
          {navLinks.map((link) => (
            <a
              key={link.id}
              className={`nav-link text-sm font-medium transition-all px-4 py-1.5 rounded-full ${
                activeSection === link.id
                  ? "text-primary bg-primary/10 font-semibold"
                  : "text-on-surface-variant hover:text-primary hover:bg-black/5"
              }`}
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Link
            to={ROUTES.LOGIN}
            className="hidden sm:inline-block text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors px-3 py-1.5"
          >
            Login
          </Link>
          <Link
            to={ROUTES.REGISTER_COMPANY}
            className="magnetic-btn bg-primary hover:bg-primary-container text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/40 transition-all active:scale-95 inline-flex items-center gap-1.5"
          >
            <span>Get Started</span>
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>

          {/* Mobile hamburger button */}
          <button
            className="md:hidden p-1.5 text-on-surface-variant hover:text-on-surface"
            type="button"
            aria-label="Toggle Navigation Menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="material-symbols-outlined text-2xl">
              {mobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-2 p-4 glass rounded-2xl border border-white/40 shadow-2xl backdrop-blur-2xl bg-white/90 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={link.href}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-on-surface hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="h-[1px] bg-outline-variant/30 my-1" />
          <Link
            to={ROUTES.LOGIN}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-on-surface hover:bg-primary/10 transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            Login to Account
          </Link>
          {onOpenDemo && (
            <button
              type="button"
              className="text-left px-4 py-2.5 rounded-xl text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenDemo();
              }}
            >
              Book a Live Demo
            </button>
          )}
        </div>
      )}
    </nav>
  );
}

