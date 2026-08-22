"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";

export function FinalCtaSection() {
  return (
    <section className="border-t border-border bg-accent-soft/50 py-24">
      <Container size="4xl" className="flex flex-col items-center text-center">
        <Reveal>
          <span className="text-meta font-semibold uppercase tracking-wider text-accent">
            Get Started Today
          </span>
          <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-ink">
            Your next job might be closer than you think.
          </h2>
          <p className="mt-4 text-base text-ink-secondary sm:text-lg max-w-2xl mx-auto">
            You may already have more relevant experience than your resume shows. Let ApplyLab translate what you&rsquo;ve actually done into the language of the job you want.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href="/signup">
              <Button size="lg" className="shadow-md px-8 py-3.5 text-base">
                Build my resume free
              </Button>
            </Link>
            <p className="text-xs text-ink-muted">
              2 resumes free &middot; No credit card required &middot; Takes less than 2 minutes
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
