import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/marketing/Logo";
import { Container } from "@/components/marketing/Container";
import { HeroSection } from "@/components/marketing/HeroSection";
import { CredentialStrip } from "@/components/marketing/CredentialStrip";
import { ConnectedJourneySection } from "@/components/marketing/ConnectedJourneySection";
import { ResumeWorkspaceSection } from "@/components/marketing/ResumeWorkspaceSection";
import { ExtensionCopilotSection } from "@/components/marketing/ExtensionCopilotSection";
import { CompactTrioSection } from "@/components/marketing/CompactTrioSection";
import { ComparisonMatrixSection } from "@/components/marketing/ComparisonMatrixSection";
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
      {/* 1. Top Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1140px] items-center justify-between px-5 sm:px-8 py-3.5">
          <Logo />

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-ink-secondary">
            <a href="#how-it-works" className="hover:text-ink transition-colors">
              How it works
            </a>
            <a href="#tailored-resume" className="hover:text-ink transition-colors">
              What you get
            </a>
            <a href="#why-applylab" className="hover:text-ink transition-colors">
              Why ApplyLab
            </a>
            <a href="#pricing" className="hover:text-ink transition-colors">
              Pricing
            </a>
            <Link href="/blog" className="hover:text-ink transition-colors">
              Blog
            </Link>
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
        {/* 2. Hero: 2-column asymmetric layout with Mock A */}
        <HeroSection />

        {/* 3. Credential Strip */}
        <CredentialStrip />

        {/* 4. How It Works: 6-Step 2x3 Grid */}
        <ConnectedJourneySection />

        {/* 5. Resume Workspace: Consolidated Matcher + Profile + Workspace with Mock B */}
        <ResumeWorkspaceSection />

        {/* 6. Extension Co-Pilot: Workday Mock C + Feature Chips */}
        <ExtensionCopilotSection />

        {/* 7. Compact Trio: Cover Letter, Interview Coach, Tracker */}
        <CompactTrioSection />

        {/* 8 & 9. Why Not ChatGPT Matrix + AU Market Strip */}
        <ComparisonMatrixSection />

        {/* 10. Trust & Integrity Guarantee (Dark Beat) */}
        <HonestExperienceTrustSection />

        {/* 11. Pricing Teaser with Monthly/3-Month Period Toggle */}
        <PricingTeaserSection />

        {/* 12. Proof + FAQ + Centred Outcome-Led Final CTA */}
        <ProofSection />
      </main>

      {/* 14. Single-Row Minimalist Footer */}
      <footer className="border-t border-border bg-surface pt-6 pb-24 sm:pb-6 text-xs text-ink-muted">
        <Container size="marketing">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <p>
              <span className="font-bold text-ink">ApplyLab</span> &middot; &copy; {new Date().getFullYear()} &middot; The AU job-search copilot
            </p>
            <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 font-medium">
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

      {/* 14. Bottom Sticky CTA */}
      <StickyCtaBar />
    </div>
  );
}


