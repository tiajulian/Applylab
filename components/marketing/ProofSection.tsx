import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";

// Honesty rule for this section: only real, verifiable proof. No invented
// testimonials, user counts, company logos, or star ratings. When we have
// more verified stories (with permission to publish), add them here as
// additional cards in the same factual, narrated style — never as a
// first-person quote unless we actually have the person's own words.
export function ProofSection() {
  return (
    <section className="border-t border-border bg-paper-deep py-20">
      <Container size="3xl">
        <Reveal>
          <h2 className="text-center font-display text-h2 text-ink">This isn&rsquo;t theoretical.</h2>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mx-auto mt-10 max-w-xl rounded border border-border bg-surface p-8 text-center shadow-sm">
            <div className="flex items-center justify-center gap-4 text-sm font-medium text-ink-secondary">
              <span className="rounded-pill bg-paper-deep px-3 py-1">Retail floor, Sydney</span>
              <span className="text-ink-muted" aria-hidden="true">
                &rarr;
              </span>
              <span className="rounded-pill bg-success-soft px-3 py-1 text-success">
                2 bank offers + a Tiffany &amp; Co interview
              </span>
            </div>
            <p className="mt-6 text-body-lg text-ink">
              A Sydney retail worker used the experience she thought was &ldquo;just retail&rdquo;
              to land two bank offers and an interview with Tiffany &amp; Co.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Same experience. Translated, not invented.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
