import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";

export function FinalCtaSection() {
  return (
    <section className="border-t border-border bg-accent-soft py-24">
      <Container size="3xl" className="flex flex-col items-center text-center">
        <Reveal>
          <h2 className="font-display text-h2 text-ink">
            The job you want isn&rsquo;t out of reach.
            <br />
            Your resume just needs to catch up.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <Link href="/signup" className="mt-8 inline-block">
            <Button size="lg">Build your first resume free</Button>
          </Link>
        </Reveal>
        <Reveal delay={0.18}>
          <p className="mt-4 text-sm text-ink-secondary">
            No credit card required for your first 2 resumes.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
