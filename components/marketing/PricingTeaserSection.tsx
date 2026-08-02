import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";

export function PricingTeaserSection() {
  return (
    <section className="border-t border-border bg-paper-deep py-20">
      <Container size="3xl" className="text-center">
        <Reveal>
          <h2 className="font-display text-h2 text-ink">Start free. Upgrade when you&rsquo;re ready.</h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mx-auto mt-3 max-w-xl text-body-lg text-ink-secondary">
            Two resumes, no card needed. Go Pro for unlimited resumes, ATS scoring, and exports.
          </p>
        </Reveal>

        <Reveal delay={0.16}>
          <div className="mx-auto mt-10 max-w-sm rounded-lg border border-border bg-surface p-9">
            <p className="text-meta font-semibold uppercase tracking-wide text-ink-secondary">
              Monthly &middot; Once, forever
            </p>
            <p className="mt-3">
              <span className="font-display text-display text-ink">$19</span>{" "}
              <span className="text-ink-secondary">AUD / month</span>
            </p>
            <Link href="/signup" className="mt-6 block">
              <Button size="lg" className="w-full">
                Build your first resume free
              </Button>
            </Link>
            <Link
              href="/upgrade"
              className="mt-3 inline-block text-sm font-medium text-ink-secondary underline decoration-border-strong underline-offset-4 transition-colors duration-fast ease-editorial hover:text-ink"
            >
              See full plans
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
