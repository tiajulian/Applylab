import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";

// Honesty rule for this section: only real, verifiable proof. No invented
// testimonials, user counts, company logos, or star ratings. The pull-quote
// below is a factual, third-person caption (not a first-person quote), since
// we don't have the candidate's own words to attribute — inventing one would
// break the same never-fabricate rule the product sells. When we have more
// verified stories (with permission to publish), add them here in the same
// factual style.
export function ProofSection() {
  return (
    <section className="py-20">
      <Container size="3xl">
        <Reveal>
          <div className="mx-auto rounded-lg bg-paper-deep p-8 text-center sm:p-11">
            <p className="font-display text-h2 italic leading-snug text-ink">
              &ldquo;Retail floor, Sydney &mdash; two bank offers and a Tiffany &amp; Co
              interview.&rdquo;
            </p>
            <p className="mx-auto mt-5 max-w-lg text-sm text-ink-secondary">
              A Sydney retail worker used the experience she thought was &ldquo;just
              retail&rdquo; to land two bank offers and an interview with Tiffany &amp; Co. Same
              experience &mdash; translated, not invented.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
