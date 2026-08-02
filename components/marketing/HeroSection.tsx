import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";
import { SkillsBridgeDemo } from "@/components/marketing/SkillsBridgeDemo";

export function HeroSection() {
  return (
    <section className="pb-20 pt-16 sm:pt-24">
      <Container size="4xl" className="flex flex-col items-center text-center">
        <Reveal>
          <h1 className="font-display text-display text-ink">
            You&rsquo;re more qualified than your resume makes you look.
          </h1>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-5 max-w-2xl text-body-lg text-ink-secondary">
            applylab turns the experience you already have into a resume that speaks the language
            of the job you want. Tailored to the ad, ready for Australian hiring systems, and
            never invented.
          </p>
        </Reveal>
        <Reveal delay={0.16}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup">
              <Button size="lg">Build your first resume free</Button>
            </Link>
            <a
              href="#how-it-works"
              className="group inline-flex h-12 items-center px-2 text-base font-medium text-ink-secondary transition-colors duration-fast ease-editorial hover:text-ink"
            >
              See how it works
              <span className="ml-1 transition-transform duration-fast ease-editorial group-hover:translate-y-0.5">
                &darr;
              </span>
            </a>
          </div>
        </Reveal>
      </Container>

      <Reveal delay={0.24}>
        <Container size="6xl" className="mt-14">
          <div className="rounded border border-border bg-surface p-4 shadow-pop sm:p-8">
            <p className="text-center text-meta font-medium uppercase tracking-wide text-ink-muted">
              Try it: where are you starting from?
            </p>
            <div className="mt-5">
              <SkillsBridgeDemo />
            </div>
          </div>
        </Container>
      </Reveal>
    </section>
  );
}
