import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";

export function HeroSection() {
  return (
    <section className="pb-10 pt-16 sm:pt-24">
      <Container size="4xl" className="flex flex-col items-center text-center">
        <Reveal>
          <span className="inline-block rounded-pill bg-accent-soft px-3.5 py-1.5 text-meta font-semibold uppercase tracking-wide text-accent">
            Built for the Australian job market
          </span>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="mt-5 font-display text-display text-ink">
            You&rsquo;re more qualified than your resume makes you look.
          </h1>
        </Reveal>
        <Reveal delay={0.14}>
          <p className="mt-5 max-w-2xl text-body-lg text-ink-secondary">
            applylab turns the experience you already have into a resume that speaks the language
            of the job you want. Tailored to the ad, ready for Australian hiring systems, and
            never invented.
          </p>
        </Reveal>
        <Reveal delay={0.22}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup">
              <Button size="lg">Build your first resume free</Button>
            </Link>
            <a
              href="#transform"
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
    </section>
  );
}
