import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/marketing/Logo";
import { HeroSection } from "@/components/marketing/HeroSection";
import { InteractiveSandbox } from "@/components/marketing/InteractiveSandbox";
import { BeforeAfterTranslationSection } from "@/components/marketing/BeforeAfterTranslationSection";
import { CareerTransitionSection } from "@/components/marketing/CareerTransitionSection";
import { JobAdMatchSection } from "@/components/marketing/JobAdMatchSection";
import { HonestExperienceTrustSection } from "@/components/marketing/HonestExperienceTrustSection";
import { AustraliaSection } from "@/components/marketing/AustraliaSection";
import { FullProductPreviewSection } from "@/components/marketing/FullProductPreviewSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { ComparisonMatrixSection } from "@/components/marketing/ComparisonMatrixSection";
import { ProofSection } from "@/components/marketing/ProofSection";
import { PricingTeaserSection } from "@/components/marketing/PricingTeaserSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FinalCtaSection } from "@/components/marketing/FinalCtaSection";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import { getCurrentUser } from "@/lib/getCurrentUser";

function initialsFor(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return initials.toUpperCase();
}

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-1 flex-col bg-paper text-ink">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <Logo />
          
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-ink-secondary">
            <a href="#how-it-works" className="hover:text-ink transition-colors">
              How it works
            </a>
            <a href="#why-applylab" className="hover:text-ink transition-colors">
              Why ApplyLab
            </a>
            <a href="#pricing" className="hover:text-ink transition-colors">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-4 text-xs font-semibold">
            {user ? (
              <Link
                href="/dashboard"
                aria-label="Go to your dashboard"
                title="You're logged in"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent transition-opacity duration-fast ease-editorial hover:opacity-90 shadow-sm"
              >
                {initialsFor(user.appUser?.full_name, user.authEmail)}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="font-medium text-ink-secondary hover:text-ink transition-colors"
                >
                  Log in
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="font-bold px-4">
                    Build my resume free
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Continuous Narrative (15 Sections) */}
      <main className="flex-1">
        {/* Section 1 & 2: Hero & Interactive 3-Column Experience Demo */}
        <HeroSection />

        {/* Section 3: "Try It Yourself" Interactive Sandbox */}
        <InteractiveSandbox />

        {/* Section 4: "The Problem Isn't Always Your Experience" Before/After Card */}
        <BeforeAfterTranslationSection />

        {/* Section 5: Career Transition Explorer */}
        <CareerTransitionSection />

        {/* Section 6: Interactive Job Requirement Matcher & Reasoning */}
        <JobAdMatchSection />

        {/* Section 7: Anti-Hallucination & Truth Guarantees */}
        <HonestExperienceTrustSection />

        {/* Section 8: Built for Australian Job Market */}
        <AustraliaSection />

        {/* Section 9: Complete 3-Pane Application Workspace Preview */}
        <div id="why-applylab">
          <FullProductPreviewSection />
        </div>

        {/* Section 10: How It Works (3 Steps) */}
        <HowItWorksSection />

        {/* Section 11: Why Not Just Use ChatGPT? */}
        <ComparisonMatrixSection />

        {/* Section 12: Real Career Transition Stories */}
        <ProofSection />

        {/* Section 13: Simple Transparent Pricing */}
        <PricingTeaserSection />

        {/* Section 14: Interactive FAQ */}
        <FaqSection />

        {/* Section 15: Final High-Impact CTA */}
        <FinalCtaSection />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-8 text-center text-xs text-ink-muted">
        <p>© {new Date().getFullYear()} applylab. Built for the Australian job market 🇦🇺.</p>
        <div className="mt-3 flex items-center justify-center gap-4 text-xs">
          <Link href="/terms" className="hover:text-ink underline">
            Terms &amp; Conditions
          </Link>
          <span>&middot;</span>
          <Link href="/terms#privacy" className="hover:text-ink underline">
            Privacy Policy
          </Link>
          <span>&middot;</span>
          <a href="mailto:support@applylab.au" className="hover:text-ink underline">
            Contact Support
          </a>
        </div>
      </footer>

      {/* Bottom Sticky CTA */}
      <StickyCtaBar />
    </div>
  );
}
