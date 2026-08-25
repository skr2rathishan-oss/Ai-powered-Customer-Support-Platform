import { useEffect, useState } from "react";
import { Navbar } from "../../components/landing/Navbar";
import { HeroSection } from "../../components/landing/HeroSection";
import { FeaturesSection } from "../../components/landing/FeaturesSection";
import { SolutionsSection } from "../../components/landing/SolutionsSection";
import { PricingSection } from "../../components/landing/PricingSection";
import { FaqSection } from "../../components/landing/FaqSection";
import { CtaBanner } from "../../components/landing/CtaBanner";
import { Footer } from "../../components/landing/Footer";
import { DemoModal } from "../../components/landing/DemoModal";

export function LandingPage() {
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Request a Live Demo");

  useEffect(() => {
    // Intersection Observer for Reveal & Fade-in animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -40px 0px",
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("active");
        }
      });
    }, observerOptions);

    const animatedElements = document.querySelectorAll(".reveal, .fade-in");
    animatedElements.forEach((el) => observer.observe(el));

    // Magnetic Button Mouse Physics
    const magneticBtns = document.querySelectorAll<HTMLElement>(".magnetic-btn");
    const cleanups: Array<() => void> = [];

    magneticBtns.forEach((btn) => {
      const handleMouseMove = (e: MouseEvent) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
      };

      const handleMouseLeave = () => {
        btn.style.transform = "";
      };

      btn.addEventListener("mousemove", handleMouseMove);
      btn.addEventListener("mouseleave", handleMouseLeave);

      cleanups.push(() => {
        btn.removeEventListener("mousemove", handleMouseMove);
        btn.removeEventListener("mouseleave", handleMouseLeave);
      });
    });

    return () => {
      animatedElements.forEach((el) => observer.unobserve(el));
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  function handleOpenDemo(customTitle?: string) {
    if (customTitle) {
      setModalTitle(customTitle);
    } else {
      setModalTitle("Request a Live Demo");
    }
    setDemoModalOpen(true);
  }

  return (
    <div className="min-h-screen bg-background text-on-surface font-body selection:bg-primary/20 selection:text-primary scroll-smooth overflow-x-hidden">
      {/* Floating Glassmorphism Navbar */}
      <Navbar onOpenDemo={() => handleOpenDemo("Book an Enterprise Demo")} />

      {/* Main Landing Sections */}
      <main>
        <HeroSection onWatchDemo={(title) => handleOpenDemo(title)} />
        <FeaturesSection onLearnMore={(feat) => handleOpenDemo(`Learn More about ${feat}`)} />
        <SolutionsSection onOpenDemo={(ind) => handleOpenDemo(`Demo for ${ind}`)} />
        <PricingSection onContactSales={() => handleOpenDemo("Contact Enterprise Sales")} />
        <FaqSection
          onContactSales={() => handleOpenDemo("Contact Sales & Solutions")}
          onLiveChat={() => handleOpenDemo("Start Interactive AI Demo")}
        />
        <CtaBanner onBookDemo={() => handleOpenDemo("Schedule Product Walkthrough")} />
      </main>

      {/* Footer */}
      <Footer />

      {/* Interactive Demo Dialog Modal */}
      <DemoModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        title={modalTitle}
      />
    </div>
  );
}

