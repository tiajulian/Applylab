import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Accordion } from "@/components/marketing/Accordion";
import { FAQ_ITEMS } from "@/lib/marketingBridgeData";

export function FaqSection() {
  const accordionItems = FAQ_ITEMS.map((item) => ({
    question: item.question,
    answer: item.answer,
  }));

  return (
    <section id="faq" className="scroll-mt-24 sec-quiet band">
      <Container size="marketing">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Frequently Asked Questions
            </span>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              Questions, answered honestly.
            </h2>
            <p className="mt-3 text-[16px] sm:text-[17.5px] text-ink-secondary leading-relaxed max-w-xl mx-auto">
              Everything you need to know about ATS compliance, data security, and how ApplyLab helps you land Australian roles.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <div className="mt-10 mx-auto max-w-3xl">
            <Accordion items={accordionItems} />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
