"use client";

import { MarketingNav } from "@/components/marketing/MarketingNav";
import { HeroSection } from "@/components/marketing/HeroSection";
import { PortalsStrip } from "@/components/marketing/PortalsStrip";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { InterviewSpotlightSection } from "@/components/marketing/InterviewSpotlightSection";
import { FreeResumeScoreSection } from "@/components/marketing/FreeResumeScoreSection";
import { StandOutSection } from "@/components/marketing/StandOutSection";
import { StoriesSection } from "@/components/marketing/StoriesSection";
import { TemplatesSection } from "@/components/marketing/TemplatesSection";
import { PricingSection } from "@/components/marketing/PricingSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FinalCtaSection } from "@/components/marketing/FinalCtaSection";
import { Footer } from "@/components/marketing/Footer";
import { useLandingObserver } from "@/components/marketing/useLandingObserver";

// Order follows how people decide: check your resume (the smallest ask, so it comes first), fix
// it, prepare for the interview, see people like you who did it, then choose a plan. Interview
// practice sits right before pricing because it's Pro's first reason to pay.
// Backgrounds alternate plain / tint (How it works is dark). StoriesSection uses the white
// surface, so it can appear or not without breaking the alternation around it.
// StatsBand, AustraliaSection, MoreFeaturesSection and PrivacySection are intentionally not
// rendered (messaging overhaul): their content moved to the hero, pricing and FAQ. The component
// files are kept so they can be restored.
export function LandingPage() {
  // Drives scroll reveals, stats count-up, and nav sentinel elevation in a single observer
  useLandingObserver();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--body)]">
      <MarketingNav />
      <main className="flex-1">
        <HeroSection />
        <PortalsStrip />
        <FreeResumeScoreSection />
        <HowItWorksSection />
        <StandOutSection />
        <InterviewSpotlightSection />
        <StoriesSection />
        <TemplatesSection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
