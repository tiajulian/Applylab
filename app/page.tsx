import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/marketing/Logo";
import { HeroSection } from "@/components/marketing/HeroSection";
import { SkillsBridgeExperience } from "@/components/marketing/SkillsBridgeExperience";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { TraceabilitySection } from "@/components/marketing/TraceabilitySection";
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
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Logo />
          <div className="flex items-center gap-6 text-sm">
            {user ? (
              <Link
                href="/dashboard"
                aria-label="Go to your dashboard"
                title="You're logged in"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent transition-opacity duration-fast ease-editorial hover:opacity-90"
              >
                {initialsFor(user.appUser?.full_name, user.authEmail)}
              </Link>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <HeroSection />
        <SkillsBridgeExperience />
        <HowItWorksSection />
        <TraceabilitySection />
        <ProofSection />
        <AustraliaSection />
        <PricingTeaserSection />
        <FaqSection />
        <FinalCtaSection />
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-ink-muted">
        <p>© {new Date().getFullYear()} applylab. Made for the Australian job market.</p>
        <p className="mt-2">
          <Link href="/terms" className="hover:text-ink">
            Terms and Conditions
          </Link>
        </p>
      </footer>

      <StickyCtaBar />
    </div>
  );
}
