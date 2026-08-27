"use client";

import { useState } from "react";
import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";
import { AutofillVideoShowcase } from "@/components/landing/AutofillVideoShowcase";

const EXTENSION_CHIPS = [
  { label: "Work rights", value: "Citizen / PR" },
  { label: "Notice period", value: "4 weeks" },
  { label: "Expected salary AUD", value: "$95,000 + super" },
  { label: "Quick-copy drawer", value: "Active" },
];

export function ExtensionCopilotSection() {
  const [selectedChip, setSelectedChip] = useState<string | null>(null);

  return (
    <section id="extension-copilot" className="scroll-mt-24 bg-paper-deep/40 py-20 border-b border-border/60">
      <Container size="marketing">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 items-center">
          {/* Left Column: Animated Autofill Video & Motion Showcase */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <Reveal delay={0.16}>
              <AutofillVideoShowcase />
            </Reveal>
          </div>

          {/* Right Column: Header, Lede, 4 Chips */}
          <div className="lg:col-span-5 flex flex-col items-start max-w-[58ch] order-1 lg:order-2">
            <Reveal>
              <span className="text-meta font-semibold uppercase tracking-wider text-accent">
                Pillar 2 &middot; Chrome Extension Co-Pilot
              </span>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                Apply without the copy-paste marathon.
              </h2>
              <p className="mt-4 text-base text-ink-secondary sm:text-lg leading-relaxed">
                Applying for jobs in Australia usually means retyping your work history twenty times. The ApplyLab Chrome extension brings your verified profile directly to SEEK, LinkedIn, Workday, and PageUp.
              </p>

              {/* Four Interactive Chips */}
              <div className="mt-8 flex flex-wrap gap-2">
                {EXTENSION_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setSelectedChip(selectedChip === chip.label ? null : chip.label)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selectedChip === chip.label
                        ? "bg-accent text-white border-accent scale-105"
                        : "border-border bg-surface text-ink-secondary hover:border-accent/40 hover:text-ink"
                    }`}
                  >
                    <span>{chip.label}</span>
                    {selectedChip === chip.label && (
                      <span className="text-[10px] bg-white/20 rounded px-1">{chip.value}</span>
                    )}
                  </button>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}

