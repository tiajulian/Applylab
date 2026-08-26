import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/marketing/Logo";
import { HeroSection } from "@/components/marketing/HeroSection";
import { ConnectedJourneySection } from "@/components/marketing/ConnectedJourneySection";
import { JobAdMatchSection } from "@/components/marketing/JobAdMatchSection";
import { CareerProfileSection } from "@/components/marketing/CareerProfileSection";
import { ResumeWorkspaceSection } from "@/components/marketing/ResumeWorkspaceSection";
import { ExtensionCopilotSection } from "@/components/marketing/ExtensionCopilotSection";
import { CoverLetterSection } from "@/components/marketing/CoverLetterSection";
import { InterviewCoachSection } from "@/components/marketing/InterviewCoachSection";
import { TrackerSection } from "@/components/marketing/TrackerSection";
import { ComparisonMatrixSection } from "@/components/marketing/ComparisonMatrixSection";
import { AustraliaSection } from "@/components/marketing/AustraliaSection";
import { HonestExperienceTrustSection } from "@/components/marketing/HonestExperienceTrustSection";
import { PricingTeaserSection } from "@/components/marketing/PricingTeaserSection";
import { ProofSection } from "@/components/marketing/ProofSection";
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
            <a href="#job-matcher" className="hover:text-ink transition-colors">
              What you get
            </a>
            <a href="#why-applylab" className="hover:text-ink transition-colors">
              Why ApplyLab
            </a>
            <a href="#pricing" className="hover:text-ink transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-ink transition-colors">
              FAQ
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
                    Start for free &rarr;
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Continuous Narrative */}
      <main className="flex-1">
        {/* Section 1: Hero with repositioned headline + interactive Job-Match card */}
        <HeroSection />

        {/* Section 2: Connected 6-Step Journey roadmap */}
        <ConnectedJourneySection />

        {/* Section 3: Pillar 1 — Job-Ad Matcher & Skills Bridge */}
        <JobAdMatchSection />

        {/* Section 4: Pillar 2 — One Verified Career Profile */}
        <CareerProfileSection />

        {/* Section 5: Pillar 3 — Tailored Resume Workspace & Fact-Check Traceability */}
        <ResumeWorkspaceSection />

        {/* Section 6: Pillar 4 — Application Co-Pilot (Chrome Extension Autofill) */}
        <ExtensionCopilotSection />

        {/* Section 7: Pillar 5 — Role-Specific Cover Letter */}
        <CoverLetterSection />

        {/* Section 8: Pillar 6 — AI Interview Coach with Voice & STAR Scorecard */}
        <InterviewCoachSection />

        {/* Section 9: Pillar 7 — Application Command Centre Kanban */}
        <TrackerSection />

        {/* Section 10: Why ApplyLab vs Generic ChatGPT Matrix */}
        <div id="why-applylab" className="scroll-mt-24">
          <ComparisonMatrixSection />
        </div>

        {/* Section 11: The Australian Hiring Edge */}
        <AustraliaSection />

        {/* Section 12: Truth & Integrity Guarantee */}
        <HonestExperienceTrustSection />

        {/* Section 13: Pricing Teaser */}
        <PricingTeaserSection />

        {/* Section 14: Social proof + FAQ + Outcome-Led Final CTA */}
        <ProofSection />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-8 text-center text-xs text-ink-muted">
        <p>© {new Date().getFullYear()} ApplyLab. The AI job-search copilot built for the Australian job market 🇦🇺.</p>
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

