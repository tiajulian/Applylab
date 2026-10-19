"use client";

import { MarketingNav } from "@/components/marketing/MarketingNav";
import { HeroSection } from "@/components/marketing/HeroSection";
import { PortalsStrip } from "@/components/marketing/PortalsStrip";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { InterviewSpotlightSection } from "@/components/marketing/InterviewSpotlightSection";
import { FreeResumeScoreSection } from "@/components/marketing/FreeResumeScoreSection";
import { HonestResumeSection } from "@/components/marketing/HonestResumeSection";
import { TemplatesSection } from "@/components/marketing/TemplatesSection";
import { PricingSection } from "@/components/marketing/PricingSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FinalCtaSection } from "@/components/marketing/FinalCtaSection";
import { Footer } from "@/components/marketing/Footer";
import { useLandingObserver } from "@/components/marketing/useLandingObserver";

// Order follows the promise: get the interview (how it works), then be ready for it (interview
// practice), then the proof (free score, honest resumes, templates) and the price.
// StatsBand, AustraliaSection, MoreFeaturesSection and PrivacySection are intentionally not
// rendered (messaging overhaul): their content moved to the hero, pricing and FAQ. The component
// files are kept so they can be restored.
export default function HomePage() {
  // Drives scroll reveals, stats count-up, and nav sentinel elevation in a single observer
  useLandingObserver();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--body)]">
      <MarketingNav />
      <main className="flex-1">
        <HeroSection />
        <PortalsStrip />
        <HowItWorksSection />
        <InterviewSpotlightSection />
        <FreeResumeScoreSection />
        <HonestResumeSection />
        <TemplatesSection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
