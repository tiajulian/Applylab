import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/marketing/Logo";
import { HeroSection } from "@/components/marketing/HeroSection";
import { IndustryPillsBanner } from "@/components/marketing/IndustryPillsBanner";
import { BentoGridShowcase } from "@/components/marketing/BentoGridShowcase";
import { SkillsBridgeExperience } from "@/components/marketing/SkillsBridgeExperience";
import { LineTransformStepper } from "@/components/marketing/LineTransformStepper";
import { TraceabilitySection } from "@/components/marketing/TraceabilitySection";
import { ComparisonMatrixSection } from "@/components/marketing/ComparisonMatrixSection";
import { ProofSection } from "@/components/marketing/ProofSection";
import { AustraliaSection } from "@/components/marketing/AustraliaSection";
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
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <Logo />
          <div className="flex items-center gap-6 text-sm">
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
                  className="group relative font-medium text-ink-secondary transition-colors duration-fast ease-editorial hover:text-ink"
                >
                  Log in
                  <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent transition-all duration ease-editorial group-hover:w-full" />
                </Link>
                <Link href="/signup">
                  <Button size="sm">Sign up free</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Landing Page Architecture (10 Sections) */}
      <main className="flex-1">
        {/* Section 1: Interactive Hero (Split 2-Column Layout) */}
        <div id="interactive-demo">
          <HeroSection />
        </div>

        {/* Section 2: Industry Breadth Banner (Authentic Australian Sectors) */}
        <IndustryPillsBanner />

        {/* Section 3: Interactive Bento Grid (ApplyLab Feature Showcase) */}
        <BentoGridShowcase />

        {/* Section 4: The Skills Bridge Experience (Interactive Widget) */}
        <SkillsBridgeExperience />

        {/* Section 5: "Watch a Line Transform" (Interactive Dot Stepper) */}
        <LineTransformStepper />

        {/* Section 6: Anti-Hallucination & Truth Guarantee (Traceability) */}
        <TraceabilitySection />

        {/* Section 7: Interactive Comparison Matrix ("Why ApplyLab?") */}
        <ComparisonMatrixSection />

        {/* Section 8: Australian Success Story & Testimonials */}
        <ProofSection />
        <AustraliaSection />

        {/* Section 9: Transparent Pricing & Interactive FAQ */}
        <PricingTeaserSection />
        <FaqSection />

        {/* Section 10: High-Impact Bottom CTA Banner */}
        <FinalCtaSection />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-8 text-center text-sm text-ink-muted">
        <p>© {new Date().getFullYear()} applylab. Made for the Australian job market 🇦🇺.</p>
        <p className="mt-2">
          <Link href="/terms" className="hover:text-ink underline">
            Terms and Conditions
          </Link>
        </p>
      </footer>

      <StickyCtaBar />
    </div>
  );
}
