"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";
import { LogoMark } from "@/components/marketing/LogoMark";

const EXTENSION_CHIPS = [
  { label: "Work rights", value: "Citizen / PR" },
  { label: "Notice period", value: "4 weeks" },
  { label: "Expected salary AUD", value: "$95,000 + super" },
  { label: "Quick-copy drawer", value: "Active" },
];

export function ExtensionCopilotSection() {
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [autofillSuccess, setAutofillSuccess] = useState(false);
  const [selectedChip, setSelectedChip] = useState<string | null>(null);

  const handleAutofill = () => {
    setIsAutofilling(true);
    setTimeout(() => {
      setIsAutofilling(false);
      setAutofillSuccess(true);
      setTimeout(() => setAutofillSuccess(false), 3000);
    }, 450);
  };

  return (
    <section id="extension-copilot" className="scroll-mt-24 bg-paper-deep/40 py-20 border-b border-border/60">
      <Container size="marketing">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 items-center">
          {/* Left Column: Product Mock C (Extension - Workday Autofill) */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <Reveal delay={0.16}>
              <div className="rounded-lg border border-border bg-paper shadow-pop overflow-hidden transition-all duration-300 hover:shadow-pop-lg">
                {/* Fake Browser Bar */}
                <div className="flex items-center justify-between border-b border-border bg-surface/80 px-4 py-2.5 backdrop-blur-sm text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                  </div>
                  <span className="font-mono text-[11px] text-ink-muted truncate max-w-[280px] sm:max-w-none">
                    https://rosterly.wd3.myworkdayjobs.com/apply/R-10492
                  </span>
                  <div className="w-8" />
                </div>

                {/* Form Card Content */}
                <div className="p-4 sm:p-6 space-y-4">
                  <div className="rounded-lg border border-border bg-surface p-4 sm:p-5 space-y-3.5 shadow-sm">
                    {/* Field 1: Mobile Phone */}
                    <div className="transition-all duration-200">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-ink-secondary mb-1">
                        <span className="uppercase tracking-wider">Mobile Phone (Australia)</span>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold transition-colors ${
                          isAutofilling ? "bg-accent-soft text-accent" : "bg-success-soft text-success border border-success/30"
                        }`}>
                          {isAutofilling ? "Filling..." : "✓ Filled"}
                        </span>
                      </div>
                      <div className={`rounded border px-3 py-2 text-xs font-mono text-ink transition-colors ${
                        isAutofilling ? "bg-accent-soft/20 border-accent/40" : "bg-paper border-border"
                      }`}>
                        0412 663 208
                      </div>
                    </div>

                    {/* Field 2: Work Rights */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-ink-secondary mb-1">
                        <span className="uppercase tracking-wider">Do you have the right to work in Australia?</span>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold transition-colors ${
                          isAutofilling ? "bg-accent-soft text-accent" : "bg-success-soft text-success border border-success/30"
                        }`}>
                          {isAutofilling ? "Filling..." : "✓ Filled"}
                        </span>
                      </div>
                      <div className={`rounded border px-3 py-2 text-xs text-ink font-medium transition-colors ${
                        isAutofilling ? "bg-accent-soft/20 border-accent/40" : "bg-paper border-border"
                      }`}>
                        Yes &mdash; Australian Citizen / Permanent Resident
                      </div>
                    </div>

                    {/* Field 3: Attach Resume */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-ink-secondary mb-1">
                        <span className="uppercase tracking-wider">Attach Resume</span>
                        <span className="rounded bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success border border-success/30">
                          ✓ Attached
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded border border-success/30 bg-success-soft/30 px-3 py-2 text-xs text-ink">
                        <span className="font-mono text-[11px]">📄 priya-nair-implementation-analyst.pdf</span>
                        <span className="text-[10px] text-ink-muted">1 page &middot; 48 KB</span>
                      </div>
                    </div>
                  </div>

                  {/* Real Floating Bar Recreated from floatingBar.ts */}
                  <div className="rounded-pill bg-[#1E293B] text-[#F8FAFC] border border-[#334155] px-3.5 py-2.5 shadow-lg flex flex-wrap items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-accent flex items-center gap-1.5 text-xs">
                        <LogoMark className="h-4 w-4" />
                        ApplyLab
                      </span>
                      <span className="text-[#94A3B8] border-r border-[#334155] pr-2.5 text-[11px] hidden sm:inline">
                        {autofillSuccess ? "⚡ 24 fields filled!" : "🟢 24 fields ready"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={handleAutofill}
                        disabled={isAutofilling}
                        className="rounded-pill bg-accent hover:bg-accent-hover active:scale-95 text-white px-3.5 py-1 text-xs font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {isAutofilling ? "Autofilling..." : "⚡ Autofill"}
                      </button>
                      <button
                        type="button"
                        className="rounded-pill bg-[#334155] hover:bg-[#475569] active:scale-95 text-[#F8FAFC] px-2.5 py-1 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        📄 Attach PDF
                      </button>
                      <button
                        type="button"
                        className="rounded-pill bg-[#334155] hover:bg-[#475569] active:scale-95 text-[#F8FAFC] px-2.5 py-1 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hidden sm:inline"
                      >
                        📊 Log to tracker
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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

