"use client";

import { useState } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";
import { Button } from "@/components/ui/Button";
import { ATSScore } from "@/components/resume/ATSScore";

const RESUME_BULLETS = [
  {
    id: "stakeholder",
    dutyRaw: "Handled customer complaints on the floor without needing a manager",
    dutyPolished: "Resolved escalated customer grievances independently, upholding strict NSW service standards and improving customer retention by 18%.",
    focus: "Stakeholder Management & De-escalation",
  },
  {
    id: "process",
    dutyRaw: "Reorganised the stockroom layout to find inventory faster",
    dutyPolished: "Redesigned stockroom layout protocols and inventory classification, reducing daily stock-retrieval cycle times by 35%.",
    focus: "Process Optimisation & Logistics",
  },
  {
    id: "reconciliation",
    dutyRaw: "Balanced daily tills to the cent at end of shift",
    dutyPolished: "Executed daily high-precision financial reconciliations across 6 POS registers with zero audit variance over 18 consecutive months.",
    focus: "Financial Accuracy & Compliance",
  },
];

export function ResumeWorkspaceSection() {
  const [selectedBulletId, setSelectedBulletId] = useState<string>("stakeholder");
  const [isPolished, setIsPolished] = useState(true);
  const [score, setScore] = useState<number | null>(82);
  const [isScoring, setIsScoring] = useState(false);

  const activeBullet = RESUME_BULLETS.find((b) => b.id === selectedBulletId) || RESUME_BULLETS[0];

  function handleScore() {
    if (isScoring) return;
    setIsScoring(true);
    setTimeout(() => {
      setScore(0);
      setTimeout(() => {
        setScore(88);
        setIsScoring(false);
      }, 60);
    }, 600);
  }

  return (
    <section id="tailored-resume" className="scroll-mt-24 py-20 bg-surface border-t border-border">
      <Container size="6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Pillar 3 &middot; Tailored Resume &amp; Workspace
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              AI that doesn&rsquo;t invent your experience.
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg">
              Tailor your resume to any job ad in seconds. Every bullet is mapped to recruiter keywords, polished with Google&rsquo;s X-Y-Z formula, and strictly traceable to your real work history.
            </p>
          </Reveal>
        </div>

        {/* Interactive Resume Workspace */}
        <div className="mt-12 mx-auto max-w-4xl rounded-2xl border border-border bg-paper p-6 sm:p-8 shadow-pop">
          {/* Workspace Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <span className="rounded bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
                📄 Tailored Resume &middot; Operations Coordinator
              </span>
              <span className="hidden sm:inline-block rounded bg-paper-deep px-2 py-1 text-[11px] font-semibold text-ink-muted">
                Strict 1-Page Format
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleScore}
                isLoading={isScoring}
                className="text-xs"
              >
                {score !== null ? "⚡ Re-score ATS Match" : "Score ATS Match"}
              </Button>
              <Button type="button" size="sm" className="text-xs">
                Export PDF / Word &darr;
              </Button>
            </div>
          </div>

          {/* ATS Score Row */}
          <div className="mt-5">
            {score !== null ? (
              <ATSScore score={score} missingKeywords={["Power BI"]} />
            ) : (
              <p className="text-xs text-ink-muted">Click &ldquo;Score ATS Match&rdquo; to test ATS compatibility.</p>
            )}
          </div>

          {/* Bullet Polisher & Traceability Inspector */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Experience Bullets &mdash; click to inspect source evidence:
              </p>
              <button
                type="button"
                onClick={() => setIsPolished((prev) => !prev)}
                className="rounded-full bg-accent-soft border border-accent/30 px-3 py-1 text-xs font-bold text-accent transition-colors hover:bg-accent hover:text-on-accent"
              >
                {isPolished ? "✨ Polished (X-Y-Z)" : "📝 Original Duty"} (Toggle)
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2.5">
              {RESUME_BULLETS.map((bullet) => {
                const isSelected = bullet.id === selectedBulletId;
                return (
                  <button
                    key={bullet.id}
                    type="button"
                    onClick={() => setSelectedBulletId(bullet.id)}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      isSelected
                        ? "border-accent bg-surface shadow-sm"
                        : "border-border bg-surface/70 hover:border-border-strong hover:bg-surface"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-ink-muted mb-1">
                      <span>{bullet.focus}</span>
                      <span className="text-accent font-bold">
                        {isSelected ? "Inspecting Source ↓" : "Click to view source"}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-ink">
                      &bull; {isPolished ? bullet.dutyPolished : bullet.dutyRaw}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Traceability Panel */}
            <div className="mt-4 rounded-xl border border-success/30 bg-success-soft/40 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-success">
                <span>🔒 Fact Traceability Anchor:</span>
                <span className="rounded bg-success/20 px-2 py-0.5 text-[10px]">
                  Verified Profile Origin
                </span>
              </div>
              <p className="mt-1.5 text-xs text-ink">
                What you told us: <span className="italic font-medium">&ldquo;{activeBullet.dutyRaw}&rdquo;</span>
              </p>
              <p className="mt-1 text-[11px] text-ink-secondary">
                ApplyLab only reshapes phrasing to meet recruiter expectations — we never fabricate unverified claims or fake metrics.
              </p>
            </div>
          </div>

          {/* Features Bar */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-border pt-4 text-center">
            <div className="rounded-lg bg-surface p-2.5 border border-border text-xs">
              <span className="font-bold text-ink">🎯 Strict 1-Page Layout</span>
              <p className="text-[11px] text-ink-secondary mt-0.5">Automated line budgeting</p>
            </div>
            <div className="rounded-lg bg-surface p-2.5 border border-border text-xs">
              <span className="font-bold text-ink">📄 ATS-Proof Formats</span>
              <p className="text-[11px] text-ink-secondary mt-0.5">Clean PDF &amp; Word .docx</p>
            </div>
            <div className="rounded-lg bg-surface p-2.5 border border-border text-xs">
              <span className="font-bold text-ink">🇦🇺 100% AU Conventions</span>
              <p className="text-[11px] text-ink-secondary mt-0.5">Zero US jargon</p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
