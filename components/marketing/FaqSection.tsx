import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";
import { Accordion } from "@/components/marketing/Accordion";

const FAQS = [
  {
    question: "Isn't this just ChatGPT?",
    answer:
      "No. General AI chat tools will happily invent job titles, metrics, or US terms if it makes the writing sound flashy. ApplyLab only works from what you actually tell us. Every line is 100% traceable to your real background.",
  },
  {
    question: "Why is an Australian-specific resume builder necessary?",
    answer:
      "Australia's top hiring portals (SEEK and Workday) penalize US spellings ('optimized' vs 'optimised') and multi-page layouts. ApplyLab automatically enforces 100% Australian English, SEEK ATS keywords, and local workplace conventions.",
  },
  {
    question: "How does ApplyLab guarantee a 1-page resume without overflow?",
    answer:
      "Our strict 1-Page Layout Budgeting Engine dynamically calculates font sizes, line heights, and section padding ladders to fit your experience onto exactly one clean page, eliminating 1.2-page spillovers and orphan headings.",
  },
  {
    question: "Can I download both PDF and Word (.docx) formats?",
    answer:
      "Yes! You can export pixel-perfect, ATS-formatted PDF documents for immediate submission, or fully editable Microsoft Word (.docx) files whenever you need to make custom tweaks.",
  },
  {
    question: "What if my experience is in a totally different field?",
    answer:
      "That's exactly what ApplyLab is built for. Our Skills Bridge engine maps transferable skills (e.g. retail customer service to corporate client operations) and translates them into the exact terminology required by your target job ad.",
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
