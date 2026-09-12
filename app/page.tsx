import Link from "next/link";
import { Container } from "@/components/marketing/Container";
import {
  MarketingHeader,
  type MarketingNavLink,
} from "@/components/marketing/MarketingHeader";
import { HeroSection } from "@/components/marketing/HeroSection";
import { CredentialStrip } from "@/components/marketing/CredentialStrip";
import { ResumeWorkspaceSection } from "@/components/marketing/ResumeWorkspaceSection";
import { TemplatesSection } from "@/components/marketing/TemplatesSection";
import { AustraliaSection } from "@/components/marketing/AustraliaSection";
import { HonestExperienceTrustSection } from "@/components/marketing/HonestExperienceTrustSection";
import { FreeResumeScoreSection } from "@/components/marketing/FreeResumeScoreSection";
import { ConnectedJourneySection } from "@/components/marketing/ConnectedJourneySection";
import { ExtensionAndFeaturesSection } from "@/components/marketing/ExtensionAndFeaturesSection";
import { ComparisonMatrixSection } from "@/components/marketing/ComparisonMatrixSection";
import { YourDataSection } from "@/components/marketing/YourDataSection";
import { PricingTeaserSection } from "@/components/marketing/PricingTeaserSection";
import { FounderAndTestimonialSection } from "@/components/marketing/FounderAndTestimonialSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FinalCtaSection } from "@/components/marketing/FinalCtaSection";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";

const NAV_LINKS: MarketingNavLink[] = [
  { href: "#score", label: "Free Resume Score", highlight: true },
  { href: "#tailored-resume", label: "Traceable Resume" },
  { href: "#templates", label: "Templates" },
  { href: "#how", label: "How It Works" },
  { href: "#why-applylab", label: "Why ApplyLab" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

// Not async, and no getCurrentUser() call: this page used to fetch the current user server-side
// purely to pass it to MarketingHeader (now self-fetched, see MarketingHeader.tsx) - and that
// getCurrentUser() call (it reads headers()) was what forced Next to render the entire page
// dynamically, per-request, for every visitor, instead of serving a static/cached copy. Dropping
// it is what actually fixes the slow LCP the rest of this pass's changes couldn't reach.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-paper text-ink">
      {/* Global Header */}
      <MarketingHeader navLinks={NAV_LINKS} ctaLabel="Score your resume free" />

      {/* 15-Section Marketing Homepage Narrative */}
      <main className="flex-1">
        {/* 1. Hero: Moat-led promise, 1 CTA, above-fold proof, layered visual */}
        <HeroSection />

        {/* 2. Portal band: Proof by association, and the price anchor */}
        <CredentialStrip />

        {/* 3. The traceable resume: The emotional core */}
        <ResumeWorkspaceSection />

        {/* 4. Eight templates: What you actually get, shown not described */}
        <TemplatesSection />

        {/* 5. The Australian hiring edge: The second moat */}
        <AustraliaSection />

        {/* 6. Truth and integrity: Full-bleed dark band */}
        <HonestExperienceTrustSection />

        {/* 7. Free resume score: The entry action */}
        <FreeResumeScoreSection />

        {/* 8. How it works: 3 core steps + secondary row */}
        <ConnectedJourneySection />

        {/* 9. Extension, then the feature trio: "And it also does this" */}
        <ExtensionAndFeaturesSection />

        {/* 10. Why not ChatGPT: Names the real competitor */}
        <ComparisonMatrixSection />

        {/* 11. Your data: De-risks signup and extension install */}
        <YourDataSection />

        {/* 12. Pricing: Free, Pro, and the $2.99 unlock */}
        <PricingTeaserSection />

        {/* 13. Founder note and testimonial: Credibility, real photograph slot */}
        <FounderAndTestimonialSection />

        {/* 14. FAQ: Objection handling */}
        <FaqSection />

        {/* 15. Final CTA: Repeats hero single CTA and proof */}
        <FinalCtaSection />
      </main>

      {/* Single-Row Minimalist Footer */}
      <footer className="border-t border-border bg-surface pt-6 pb-24 sm:pb-6 text-xs text-ink-muted">
        <Container size="marketing">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <p>
              <span className="font-bold text-ink">ApplyLab</span> &middot; &copy; {new Date().getFullYear()} &middot; The Australian job-search copilot 🇦🇺
            </p>
            <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 font-medium">
              <Link href="/resume-score" className="text-accent font-semibold hover:underline">
                Free Resume Score
              </Link>
              <Link href="/blog" className="hover:text-ink transition-colors">
                Blog
              </Link>
              <Link href="/terms" className="hover:text-ink transition-colors">
                Terms &amp; Conditions
              </Link>
              <Link href="/privacy" className="hover:text-ink transition-colors">
                Privacy Policy
              </Link>
              <a href="mailto:support@applylab.au" className="hover:text-ink transition-colors">
                Contact Support
              </a>
            </div>
          </div>
        </Container>
      </footer>

      {/* Mobile Sticky CTA Bar (displays below 900px) */}
      <StickyCtaBar />
    </div>
  );
}
