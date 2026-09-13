"use client";

import { MarketingNav } from "@/components/marketing/MarketingNav";
import { HeroSection } from "@/components/marketing/HeroSection";
import { PortalsStrip } from "@/components/marketing/PortalsStrip";
import { StatsBand } from "@/components/marketing/StatsBand";
import { TemplatesSection } from "@/components/marketing/TemplatesSection";
import { FreeResumeScoreSection } from "@/components/marketing/FreeResumeScoreSection";
import { TraceableResumeSection } from "@/components/marketing/TraceableResumeSection";
import { AustraliaSection } from "@/components/marketing/AustraliaSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { MoreFeaturesSection } from "@/components/marketing/MoreFeaturesSection";
import { PrivacySection } from "@/components/marketing/PrivacySection";
import { ComparisonSection } from "@/components/marketing/ComparisonSection";
import { PricingSection } from "@/components/marketing/PricingSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FinalCtaSection } from "@/components/marketing/FinalCtaSection";
import { Footer } from "@/components/marketing/Footer";
import { useLandingObserver } from "@/components/marketing/useLandingObserver";

export default function HomePage() {
  // Drives scroll reveals, stats count-up, and nav sentinel elevation in a single observer
  useLandingObserver();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--body)]">
      <MarketingNav />
      <main className="flex-1">
        <HeroSection />
        <PortalsStrip />
        <StatsBand />
        <TemplatesSection />
        <FreeResumeScoreSection />
        <TraceableResumeSection />
        <AustraliaSection />
        <HowItWorksSection />
        <MoreFeaturesSection />
        <PrivacySection />
        <ComparisonSection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
