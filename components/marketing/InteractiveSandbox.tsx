"use client";

import { useState } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/marketing/Container";
import { AnimatePresence, motion } from "framer-motion";

const SAMPLE_INPUTS = [
  {
    label: "Retail Experience",
    text: "I handled customer complaints, trained new staff and opened the store when my manager wasn't there.",
    found: ["Customer service", "Team training", "Operational responsibility", "Independent decision-making"],
    result: "Trained new team members and independently managed store operations, including opening procedures and escalated customer issues.",
  },
  {
    label: "Hospitality Shift",
    text: "I managed busy Saturday dinner shifts, fixed order mistakes before customers noticed, and scheduled casual workers.",
    found: ["Real-time resourcing", "Service recovery", "Multi-channel scheduling", "De-escalation"],
    result: "Directed peak dinner service operations, proactively resolving order discrepancies and coordinating casual staffing schedules.",
  },
  {
    label: "Office Admin",
    text: "I organized client meetings, answered general email inquiries, and kept track of project deadlines on Excel.",
    found: ["Schedule management", "Client communication", "Deliverable tracking", "Data organization"],
    result: "Facilitated client meeting schedules, managed primary email correspondence, and tracked operational project deliverables in Excel.",
  },
];

export function InteractiveSandbox() {
  const [inputText, setInputText] = useState(SAMPLE_INPUTS[0].text);
  const [isTranslating, setIsTranslating] = useState(false);
  const [activeOutput, setActiveOutput] = useState(SAMPLE_INPUTS[0]);
  const [hasTranslated, setHasTranslated] = useState(true);

  function handleTranslate() {
    if (!inputText.trim()) return;
    setIsTranslating(true);

    const matched = SAMPLE_INPUTS.find(
      (s) => s.text.toLowerCase().trim() === inputText.toLowerCase().trim()
    );

    setTimeout(() => {
      if (matched) {
        setActiveOutput(matched);
      } else {
        const words = inputText.toLowerCase();
        const customFound: string[] = [];
        if (words.includes("complaint") || words.includes("customer") || words.includes("client")) customFound.push("Customer resolution");
        if (words.includes("train") || words.includes("staff") || words.includes("people")) customFound.push("Team coaching");
        if (words.includes("manage") || words.includes("open") || words.includes("store") || words.includes("lead")) customFound.push("Operational responsibility");
        if (words.includes("excel") || words.includes("report") || words.includes("data") || words.includes("schedule")) customFound.push("Process organization");
        if (customFound.length === 0) customFound.push("Problem solving", "Adaptability under pressure");

        setActiveOutput({
          label: "Custom Input",
          text: inputText,
          found: customFound,
          result: `Proactively managed operational duties, resolving day-to-day issues independently based on provided details: "${inputText.trim()}".`,
        });
      }
      setIsTranslating(false);
      setHasTranslated(true);
    }, 400);
  }

  function loadSample(sample: typeof SAMPLE_INPUTS[0]) {
    setInputText(sample.text);
    setActiveOutput(sample);
    setHasTranslated(true);
  }

  return (
    <section className="py-16 bg-paper-deep/50 border-y border-border/60">
      <Container size="6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Interactive Sandbox
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              What have you actually done?
            </h2>
            <p className="mt-3 text-base text-ink-secondary sm:text-lg">
              Don&rsquo;t worry about using the &ldquo;right&rdquo; words. Just tell us what happened.
            </p>
          </Reveal>
        </div>

        <div className="mt-10 mx-auto max-w-4xl rounded-2xl border border-border bg-surface p-6 shadow-pop sm:p-8">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Quick samples:
            </span>
            {SAMPLE_INPUTS.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => loadSample(sample)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  inputText === sample.text
                    ? "bg-accent text-on-accent"
                    : "bg-paper-deep text-ink-secondary hover:text-ink border border-border"
                }`}
              >
                {sample.label}
              </button>
            ))}
          </div>

          {/* Interactive Text Field & Submit */}
          <div className="flex flex-col sm:flex-row gap-3">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. I handled customer complaints, trained new staff and opened the store when my manager wasn't there..."
              rows={3}
              className="flex-1 rounded-lg border border-border-strong bg-paper p-3.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
            />
            <div className="flex sm:flex-col justify-end">
              <Button
                type="button"
                onClick={handleTranslate}
                disabled={isTranslating || !inputText.trim()}
                className="w-full sm:w-auto h-full px-6 py-3"
              >
                {isTranslating ? "Translating..." : "Translate my experience"}
              </Button>
            </div>
          </div>

          {/* Animated Result Card */}
          <AnimatePresence mode="wait">
            {hasTranslated && (
              <motion.div
                key={activeOutput.result}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="mt-6 border-t border-border pt-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  {/* Found Competencies */}
                  <div className="md:col-span-5 rounded-xl border border-accent/20 bg-accent-soft/30 p-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-accent">
                      We found:
                    </span>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {activeOutput.found.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1 rounded bg-surface px-2.5 py-1 text-xs font-semibold text-ink border border-accent/20 shadow-sm"
                        >
                          <span className="text-accent">&#10003;</span> {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Resume Ready Output */}
                  <div className="md:col-span-7 rounded-xl border border-success/30 bg-success-soft/20 p-4">
                    <div className="flex items-center justify-between border-b border-success/20 pb-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-success">
                        Resume-ready version:
                      </span>
                      <span className="rounded bg-success/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">
                        Based only on what you told us
                      </span>
                    </div>
                    <p className="mt-3 text-xs sm:text-sm font-medium text-ink leading-relaxed">
                      • {activeOutput.result}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Container>
    </section>
  );
}
