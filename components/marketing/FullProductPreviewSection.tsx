"use client";

import { useState } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";

const PRODUCT_SKILL_MATCHES = [
  {
    id: "stakeholder",
    name: "Stakeholder Management",
    sourceExp: "Handled customer complaints on floor independently",
    resumeBullet: "Resolved escalated customer concerns independently, maintaining service standards under pressure.",
  },
  {
    id: "process",
    name: "Process Improvement",
    sourceExp: "Reorganized stockroom layout to improve retrieval time",
    resumeBullet: "Redesigned inventory storage protocols, improving stock retrieval speeds and operational workflow efficiency.",
  },
  {
    id: "reconciliation",
    name: "Financial Reconciliation",
    sourceExp: "Balanced daily tills to the cent at end of shift",
    resumeBullet: "Executed daily high-accuracy financial reconciliations and maintained strict shift close auditing standards.",
  },
  {
    id: "onboarding",
    name: "Team Onboarding",
    sourceExp: "Trained new casual starters during their first week",
    resumeBullet: "Onboarded and coached new team members, accelerating time-to-productivity for frontline staff.",
  },
];

const WORKFLOW_STEPS = [
  { step: "01", label: "Tell us what you've done" },
  { step: "02", label: "Add the job you want" },
  { step: "03", label: "Get the whole application" },
];

const COVER_LETTER_SNIPPET =
  "Metro Logistics' operations team needs someone who keeps things moving under pressure — that's exactly what I did every weekend as a shift supervisor, handling escalations and coordinating floor staff without needing a manager on hand.";

export function FullProductPreviewSection() {
  const [selectedSkillId, setSelectedSkillId] = useState<string>("stakeholder");
  const [activePane, setActivePane] = useState<"resume" | "cover-letter">("resume");

  const activeMatch = PRODUCT_SKILL_MATCHES.find((s) => s.id === selectedSkillId) || PRODUCT_SKILL_MATCHES[0];

  return (
    <section id="how-it-works" className="scroll-mt-24 py-20 bg-paper-deep/50 border-t border-border">
      <Container size="6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Your Application Copilot
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              From job ad to job-ready application.
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg">
              Click any skill on the right to trace the complete evidence chain: <strong className="text-ink">Experience &rarr; Skill &rarr; Resume Bullet</strong>.
            </p>
          </Reveal>
        </div>

        {/* Narrative spine */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-ink-secondary">
          {WORKFLOW_STEPS.map((item, idx) => (
            <div key={item.step} className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="text-accent font-display font-bold">{item.step}</span>
                {item.label}
              </span>
              {idx < WORKFLOW_STEPS.length - 1 && <span className="text-ink-muted">&rarr;</span>}
            </div>
          ))}
        </div>

        {/* 3-Pane Product Workspace Preview */}
        <div className="mt-10 rounded-2xl border border-border bg-surface p-4 sm:p-6 shadow-pop overflow-hidden">
          {/* Top Window Bar */}
          <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-critical/70" />
              <span className="h-3 w-3 rounded-full bg-attention/70" />
              <span className="h-3 w-3 rounded-full bg-success/70" />
              <span className="ml-2 text-xs font-semibold text-ink-muted hidden sm:inline">
                ApplyLab Application Workspace — Operations Coordinator
              </span>
            </div>
            <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success border border-success/20">
              94% Match Score
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Pane: Job Ad */}
            <div className="lg:col-span-3 rounded-xl border border-border bg-paper p-4 text-left flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  JOB ADVERTISEMENT
                </span>
                <h4 className="mt-1 font-display text-sm font-bold text-ink">
                  Operations Coordinator
                </h4>
                <p className="text-[11px] text-ink-secondary">Metro Logistics &middot; Sydney NSW</p>

                <div className="mt-4 space-y-2 text-xs">
                  <p className="font-semibold text-ink-secondary">Requirements:</p>
                  <ul className="space-y-1.5 text-[11px] text-ink">
                    <li className="flex items-center gap-1 font-medium">✓ Stakeholder management</li>
                    <li className="flex items-center gap-1 font-medium">✓ Process improvement</li>
                    <li className="flex items-center gap-1 font-medium">✓ Reporting &amp; reconciliation</li>
                    <li className="flex items-center gap-1 font-medium">✓ Team onboarding</li>
                    <li className="flex items-center gap-1 text-ink-muted">○ Power BI (Missing)</li>
                  </ul>
                </div>
              </div>
              <p className="mt-4 text-[10px] text-ink-muted border-t border-border/60 pt-2">
                Source: SEEK Job #789124
              </p>
            </div>

            {/* Center Pane: Resume / Cover Letter Preview */}
            <div className="lg:col-span-5 rounded-xl border border-border bg-surface p-5 text-left flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h4 className="font-display text-base font-bold text-ink">Alex Taylor</h4>
                    <p className="text-[11px] text-ink-secondary">
                      Operations &amp; Customer Support Specialist &middot; Sydney, NSW
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1 rounded-full border border-border bg-paper-deep p-0.5 text-[10px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setActivePane("resume")}
                      className={`rounded-full px-2.5 py-1 transition-colors ${
                        activePane === "resume" ? "bg-accent text-on-accent" : "text-ink-secondary hover:text-ink"
                      }`}
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePane("cover-letter")}
                      className={`rounded-full px-2.5 py-1 transition-colors ${
                        activePane === "cover-letter" ? "bg-accent text-on-accent" : "text-ink-secondary hover:text-ink"
                      }`}
                    >
                      Cover Letter
                    </button>
                  </div>
                </div>

                {activePane === "resume" ? (
                  <div className="mt-4 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                      Professional Experience
                    </span>

                    {PRODUCT_SKILL_MATCHES.map((match) => {
                      const isSelected = match.id === selectedSkillId;
                      return (
                        <div
                          key={match.id}
                          onClick={() => setSelectedSkillId(match.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? "border-accent bg-accent-soft/40 shadow-sm"
                              : "border-transparent hover:border-border hover:bg-paper-deep/60"
                          }`}
                        >
                          <p className="text-xs font-medium text-ink leading-relaxed">
                            • {match.resumeBullet}
                          </p>
                          {isSelected && (
                            <span className="mt-1.5 inline-block text-[10px] font-bold text-accent">
                              ✨ Active Match: {match.name}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                      Cover Letter (opening paragraph)
                    </span>
                    <p className="mt-3 text-xs font-medium text-ink leading-relaxed italic">
                      &ldquo;{COVER_LETTER_SNIPPET}&rdquo;
                    </p>
                    <p className="mt-3 text-[10px] text-ink-muted">
                      Drawn from the same evidence as your resume &mdash; nothing new invented.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-2 border-t border-border/60 flex items-center justify-between text-[10px] text-ink-muted">
                <span>Strict 1-Page Layout</span>
                <span>Australian English</span>
              </div>
            </div>

            {/* Right Pane: Match Panel & Evidence Chain */}
            <div className="lg:col-span-4 rounded-xl border border-accent/30 bg-accent-soft/30 p-4 text-left flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-accent/20 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-accent">
                    MATCH PANEL
                  </span>
                  <span className="text-xs font-bold text-success">94%</span>
                </div>

                <div className="mt-3">
                  <span className="text-[11px] font-semibold text-ink-muted">Select Skill to Trace Evidence:</span>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {PRODUCT_SKILL_MATCHES.map((match) => {
                      const isSelected = match.id === selectedSkillId;
                      return (
                        <button
                          key={match.id}
                          type="button"
                          onClick={() => setSelectedSkillId(match.id)}
                          className={`flex items-center justify-between px-3 py-2 rounded text-xs font-semibold transition-all ${
                            isSelected
                              ? "bg-accent text-on-accent shadow-sm"
                              : "bg-surface text-ink-secondary hover:text-ink border border-border"
                          }`}
                        >
                          <span>✓ {match.name}</span>
                          {isSelected && <span>&rarr;</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Evidence Tracing Details */}
                <div className="mt-4 rounded-lg bg-surface p-3.5 border border-accent/20 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                    WHY THIS MATCHES
                  </span>
                  <p className="mt-1 font-medium text-ink italic">
                    &ldquo;{activeMatch.sourceExp}&rdquo;
                  </p>
                  <div className="mt-2 text-[11px] text-success font-semibold flex items-center gap-1">
                    <span>&rarr;</span>
                    <span>Mapped directly into resume wording</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-[10px] font-bold text-ink-muted text-center border-t border-accent/20 pt-2">
                Evidence Chain Verified &middot; Zero Hallucinations
              </div>
            </div>
          </div>
        </div>

        {/* Beyond the resume */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink-secondary">
            <span className="text-success">✓</span> Cover letter drafted from the same evidence
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink-secondary">
            <span className="text-success">✓</span> STAR-method screening answers &mdash; via the Chrome extension
          </span>
        </div>
      </Container>
    </section>
  );
}
