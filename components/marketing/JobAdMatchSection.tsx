"use client";

import { useState } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";
import { MOCK_JOB_AD } from "@/lib/marketingBridgeData";

export function JobAdMatchSection() {
  const [selectedReqId, setSelectedReqId] = useState<string>("stakeholder");

  const activeReq = MOCK_JOB_AD.requirements.find((r) => r.id === selectedReqId) || MOCK_JOB_AD.requirements[0];

  return (
    <section className="py-20 bg-surface">
      <Container size="6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Evidence-Based Job Matching
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Start with the job you actually want.
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg">
              Click any requirement below to see how ApplyLab connects your real experience to the job criteria.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Mock Job Advertisement */}
          <div className="lg:col-span-6 rounded-2xl border border-border bg-paper p-6 shadow-pop">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="rounded bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
                  SEEK Job Advertisement
                </span>
                <h3 className="mt-2 font-display text-xl font-bold text-ink">
                  {MOCK_JOB_AD.title}
                </h3>
                <p className="text-xs text-ink-secondary font-medium">
                  {MOCK_JOB_AD.company} &middot; {MOCK_JOB_AD.location}
                </p>
              </div>
              <span className="text-xs font-bold text-success bg-success-soft px-2.5 py-1 rounded-full">
                Active Listing
              </span>
            </div>

            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-3">
                Key Job Requirements (Click to inspect match):
              </p>
              <div className="flex flex-col gap-2">
                {MOCK_JOB_AD.requirements.map((req) => {
                  const isSelected = req.id === selectedReqId;
                  return (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => setSelectedReqId(req.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border text-left text-xs font-medium transition-all ${
                        isSelected
                          ? "border-accent bg-accent-soft/40 text-ink shadow-sm"
                          : "border-border bg-surface text-ink-secondary hover:text-ink hover:border-border-strong"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-success font-bold">&#10003;</span>
                        <span className="font-semibold">{req.title}</span>
                      </div>
                      <span className="text-[11px] text-accent font-semibold">
                        {isSelected ? "Inspecting →" : "Click to view evidence"}
                      </span>
                    </button>
                  );
                })}

                {/* Missing Skill Pill */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-paper-deep text-ink-muted text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-ink-muted font-bold">○</span>
                    <span className="font-medium">{MOCK_JOB_AD.missingSkill.title}</span>
                  </div>
                  <span className="text-[11px] text-ink-muted italic">Missing in your profile</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Reasoning & Match Details */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            {/* Match Evidence Box */}
            <div className="rounded-2xl border border-accent/30 bg-surface p-6 shadow-pop">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-accent">
                  Why This Matches: {activeReq.title}
                </span>
                <span className="rounded bg-accent/15 px-2.5 py-0.5 text-[11px] font-bold text-accent">
                  Evidence Verified
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-4">
                <div className="rounded-lg bg-paper-deep p-3.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    Source Experience Found:
                  </span>
                  <p className="mt-1 text-xs italic font-medium text-ink">
                    &ldquo;{activeReq.sourceText}&rdquo;
                  </p>
                </div>

                <div className="rounded-lg bg-accent-soft/30 p-3.5 border border-accent/20">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
                    Reasoning:
                  </span>
                  <p className="mt-1 text-xs font-medium text-ink leading-relaxed">
                    {activeReq.whyMatches}
                  </p>
                </div>

                <div className="rounded-lg bg-success-soft/30 p-3.5 border border-success/20">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-success">
                    Generated Resume Wording:
                  </span>
                  <p className="mt-1 text-xs font-semibold text-ink leading-relaxed">
                    • {activeReq.resumeWording}
                  </p>
                </div>
              </div>
            </div>

            {/* Match Score & Honest Guarantee Box */}
            <div className="rounded-2xl border border-border bg-paper p-6 shadow-sm">
              <div className="flex items-center gap-4 border-b border-border pb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success text-base font-extrabold border border-success/30">
                  94%
                </div>
                <div>
                  <h4 className="font-display text-base font-bold text-ink">
                    94% Job Match Score
                  </h4>
                  <p className="text-xs text-ink-secondary">
                    5 strong evidence matches &middot; 1 missing skill flagged
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-surface p-3.5 border border-border text-xs text-ink-secondary leading-relaxed flex items-start gap-2">
                <span className="text-accent text-sm">💡</span>
                <div>
                  <strong className="text-ink">Honest Match Guarantee:</strong> {MOCK_JOB_AD.missingSkill.note} If the experience isn&rsquo;t in your background, ApplyLab flags it rather than fabricating fake claims.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
