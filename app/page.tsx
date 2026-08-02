import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { HeroSection } from "@/components/marketing/HeroSection";
import { EmpathySection } from "@/components/marketing/EmpathySection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { DifferentiatorSection } from "@/components/marketing/DifferentiatorSection";
import { HonestySection } from "@/components/marketing/HonestySection";
import { ProofSection } from "@/components/marketing/ProofSection";
import { AustraliaSection } from "@/components/marketing/AustraliaSection";
import { PricingTeaserSection } from "@/components/marketing/PricingTeaserSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FinalCtaSection } from "@/components/marketing/FinalCtaSection";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="font-display text-lg font-medium text-ink">applylab</span>
          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/login"
              className="group relative text-ink-secondary transition-colors duration-fast ease-editorial hover:text-ink"
            >
              Log in
              <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent transition-all duration ease-editorial group-hover:w-full" />
            </Link>
            <Link href="/signup">
              <Button size="sm">Sign up free</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <HeroSection />
        <EmpathySection />
        <HowItWorksSection />
        <DifferentiatorSection />
        <HonestySection />
        <ProofSection />
        <AustraliaSection />
        <PricingTeaserSection />
        <FaqSection />
        <FinalCtaSection />
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-ink-muted">
        © {new Date().getFullYear()} applylab. Made for the Australian job market.
      </footer>

      <StickyCtaBar />
    </div>
  );
}
