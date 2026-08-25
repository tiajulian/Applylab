"use client";

import { useState } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountUp } from "@/components/ui/CountUp";
import { MOCK_JOB_AD, SANDBOX_SAMPLES } from "@/lib/marketingBridgeData";

const TOTAL_REQUIREMENTS = MOCK_JOB_AD.requirements.length + 1;

export function JobAdMatchSection() {
  const [selectedReqId, setSelectedReqId] = useState<string>("stakeholder");
  const [inputText, setInputText] = useState(SANDBOX_SAMPLES[0].text);
  const [activeSampleId, setActiveSampleId] = useState(SANDBOX_SAMPLES[0].id);

  const activeReq = MOCK_JOB_AD.requirements.find((r) => r.id === selectedReqId) || MOCK_JOB_AD.requirements[0];

  function loadSample(sample: (typeof SANDBOX_SAMPLES)[number]) {
    setInputText(sample.text);
    setActiveSampleId(sample.id);
    setSelectedReqId(sample.matchesRequirementId);
  }

  return (
    <section id="interactive-demo" className="scroll-mt-24 py-20 bg-surface">
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
              Paste a real job ad, tell us what you&rsquo;ve actually done, and this is the exact screen you&rsquo;ll see &mdash; the same review step every resume goes through.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Job context + your experience input */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="rounded-2xl border border-border bg-paper p-6 shadow-pop">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Job you&rsquo;re applying for
              </span>
              <h3 className="mt-1 font-display text-xl font-bold text-ink">
                {MOCK_JOB_AD.title}
              </h3>
              <p className="text-xs text-ink-secondary font-medium">
                {MOCK_JOB_AD.company} &middot; {MOCK_JOB_AD.location}
              </p>

              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-3">
                  Requirements (click to inspect):
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
                        <span className="font-semibold">{req.title}</span>
                        <span className="text-[11px] text-accent font-semibold">
                          {isSelected ? "Inspecting →" : "Click to view"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Your experience sandbox */}
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-pop">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                What have you actually done?
              </span>
              <p className="mt-1 text-xs text-ink-secondary">
                Don&rsquo;t worry about using the &ldquo;right&rdquo; words &mdash; try one of these, or write your own.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {SANDBOX_SAMPLES.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => loadSample(sample)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      activeSampleId === sample.id
                        ? "bg-accent text-on-accent"
                        : "bg-paper-deep text-ink-secondary hover:text-ink border border-border"
                    }`}
                  >
                    {sample.label}
                  </button>
                ))}
              </div>

              <textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setActiveSampleId("custom");
                }}
                rows={3}
                className="mt-3 w-full rounded-lg border border-border-strong bg-paper p-3.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Right Column: the actual skills-bridge review screen */}
          <div className="lg:col-span-7 rounded-2xl border border-border bg-surface p-6 sm:p-7 shadow-pop">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              Your skills bridge
            </p>
            <p className="mt-3 text-base font-medium text-ink">
              You match <CountUp value={MOCK_JOB_AD.requirements.length} className="tabular-nums font-bold" /> of {TOTAL_REQUIREMENTS} must-haves
            </p>
            <ProgressBar value={Math.round((MOCK_JOB_AD.requirements.length / TOTAL_REQUIREMENTS) * 100)} className="mt-2" />
            <p className="mt-3 text-xs text-ink-secondary">
              We only add what&rsquo;s true, so confirm anything we&rsquo;re unsure about.
            </p>

            <div className="mt-5 flex flex-col gap-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">You&rsquo;ve got these</p>
              <div className="rounded p-4 bg-success-soft">
                <p className="flex items-start gap-2 text-sm text-ink">
                  <span className="mt-0.5 text-success">&#10003;</span>
                  <span>
                    <span className="font-medium">{activeReq.title}</span>
                    <span className="text-ink-secondary"> &rarr; helps meet job requirement</span>
                  </span>
                </p>
                <p className="mt-1 text-xs italic text-ink-muted">
                  &ldquo;{activeReq.sourceText}&rdquo;
                </p>
                <p className="mt-2 text-xs font-medium text-ink">
                  Goes on your resume as: <span className="italic">&ldquo;{activeReq.resumeWording}&rdquo;</span>
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Honest gaps</p>
                <p className="mt-1 text-xs text-ink-secondary">
                  Nothing in your profile backs this up yet.
                </p>
              </div>
              <div className="rounded bg-paper-deep p-4">
                <p className="text-sm font-medium text-ink">{MOCK_JOB_AD.missingSkill.title}</p>
                <p className="mt-1 text-xs text-ink-muted">Wanted for: {MOCK_JOB_AD.title}</p>
                <p className="mt-2 text-xs text-ink-secondary">
                  ApplyLab leaves it off rather than inventing it &mdash; the honest default.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
