import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";
import { Accordion } from "@/components/marketing/Accordion";

const FAQS = [
  {
    question: "Isn't this just ChatGPT?",
    answer:
      "No. General AI chat tools will happily invent a job title or a metric if it makes the writing sound better. applylab only works from what you actually tell it, and every suggested skill has to be confirmed by you before it goes anywhere near your resume.",
  },
  {
    question: "Will it make things up?",
    answer:
      "Never. If we can't trace a line back to something you told us, it doesn't go on the resume. Gaps stay gaps until you fill them in.",
  },
  {
    question: "What if my experience is in a totally different field?",
    answer:
      "That's exactly what applylab is built for. We look for the underlying skill, not the job title, and match it against what the ad is actually asking for.",
  },
  {
    question: "Is it really made for Australian jobs?",
    answer:
      "Yes. Australian English, SEEK and Workday-ready formatting, and the one-page conventions local recruiters expect, by default.",
  },
  {
    question: "What if I don't have much experience yet?",
    answer:
      "We still find what's there — study, volunteering, casual work — and translate it honestly. What we won't do is invent experience you don't have.",
  },
];

export function FaqSection() {
  return (
    <section className="py-20">
      <Container size="3xl">
        <Reveal>
          <h2 className="text-center font-display text-h2 text-ink">Questions, answered honestly.</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10">
            <Accordion items={FAQS} />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
