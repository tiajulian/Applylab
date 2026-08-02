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
      "No. That's the whole guarantee: every line traces back to something you told us. If we can't find a match for a requirement in your history, we tell you honestly instead of inventing one.",
  },
  {
    question: "What if my experience is in a totally different field?",
    answer:
      "That's exactly what the Skills Bridge is for. Retail, hospitality, healthcare, admin, trades — most roles build real transferable skills like stakeholder management, prioritisation, and accuracy under pressure. We help you find and translate them.",
  },
  {
    question: "Is it really made for Australian jobs?",
    answer:
      "Yes. Australian English spelling, A4 one-page formatting, and layouts built to parse cleanly through SEEK, PageUp and Workday, the systems most Australian employers actually use.",
  },
  {
    question: "What if I don't have much experience yet?",
    answer:
      "You still have more than a blank template gives you credit for: study projects, casual work, volunteering, and everyday responsibilities all count. We help you find the transferable parts and present them honestly.",
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
