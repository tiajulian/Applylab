import Link from "next/link";
import { Container } from "@/components/marketing/Container";
import { MarketingHeader, toMarketingUser, type MarketingNavLink } from "@/components/marketing/MarketingHeader";
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

const NAV_LINKS: MarketingNavLink[] = [
  { href: "/resume-score", label: "Free Resume Score", highlight: true },
  { href: "#how-it-works", label: "How it works" },
  { href: "#tailored-resume", label: "What you get" },
  { href: "#why-applylab", label: "Why ApplyLab" },
  { href: "#pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "#faq", label: "FAQ" },
];

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-1 flex-col bg-paper text-ink">
      <MarketingHeader navLinks={NAV_LINKS} user={toMarketingUser(user)} ctaLabel="Start for free →" />

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

      {/* 14. Bottom Sticky CTA */}
      <StickyCtaBar />
    </div>
  );
}


