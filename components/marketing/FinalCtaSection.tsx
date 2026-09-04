import Link from "next/link";
import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { PROOF_FIGURES } from "@/lib/marketingProofData";

export function FinalCtaSection() {
  return (
    <section className="sec bg-paper border-t border-border">
      <Container size="marketing">
        <div className="mx-auto max-w-3xl flex flex-col items-center text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Get Started Today
            </span>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-ink leading-tight">
              Resumes you can actually defend in an Australian interview.
            </h2>
            <p className="mt-4 text-[16px] sm:text-[17.5px] text-ink-secondary leading-relaxed max-w-xl mx-auto">
              Build your verified career profile once. Generate ATS-safe tailored resumes, autofill application portals on SEEK, and walk into interviews prepared.
            </p>
          </Reveal>

          {/* Single CTA Repeated from Hero */}
          <Reveal delay={0.12}>
            <div className="mt-8 flex flex-col items-center gap-3 w-full sm:w-auto">
              <a href="#score" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto px-8 py-3.5 text-base font-bold shadow-md transition-transform active:scale-[0.98]"
                >
                  Score your resume free &rarr;
                </Button>
              </a>
              <Link
                href="/onboarding"
                className="text-xs font-semibold text-ink-secondary hover:text-ink transition-colors underline-offset-4 hover:underline px-1"
              >
                Or build your full profile &rarr;
              </Link>
              <p className="text-meta text-ink-muted">
                2 applications free &middot; No credit card required &middot; 100% Australian English
              </p>
            </div>
          </Reveal>

          {/* Above-the-fold Proof Repeated */}
          <Reveal delay={0.18}>
            <div className="mt-10 flex items-center gap-4 text-xs text-ink-muted border-t border-border/80 pt-6">
              <div className="flex items-center gap-1 font-semibold text-ink">
                <span className="text-accent font-bold text-sm">★</span>
                <span className="font-mono">{PROOF_FIGURES.chromeRating}</span>
                <span className="font-normal text-ink-muted">Chrome rating</span>
              </div>
              <div className="h-3 w-px bg-border" aria-hidden="true" />
              <div className="font-medium">
                <span className="font-mono font-bold text-ink">{PROOF_FIGURES.userCount}</span> Australian job seekers
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
