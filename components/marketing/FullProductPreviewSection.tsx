"use client";

import { useState } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";
import { Button } from "@/components/ui/Button";
import { ATSScore } from "@/components/resume/ATSScore";

const RESUME_BULLETS = [
  {
    id: "stakeholder",
    text: "Resolved escalated customer concerns independently, maintaining service standards under pressure.",
    sourceExp: "Handled customer complaints on the floor without needing a manager",
  },
  {
    id: "process",
    text: "Redesigned inventory storage protocols, improving stock retrieval speeds and operational workflow efficiency.",
    sourceExp: "Reorganised the stockroom layout to find inventory faster",
  },
  {
    id: "reconciliation",
    text: "Executed daily high-accuracy financial reconciliations and maintained strict shift-close auditing standards.",
    sourceExp: "Balanced daily tills to the cent at end of shift",
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
  const [selectedBulletId, setSelectedBulletId] = useState<string>("stakeholder");
  const [tab, setTab] = useState<"resume" | "cover-letter">("resume");
  const [score, setScore] = useState<number | null>(null);
  const [isScoring, setIsScoring] = useState(false);

  const activeBullet = RESUME_BULLETS.find((b) => b.id === selectedBulletId) || RESUME_BULLETS[0];

  function handleScore() {
    if (isScoring) return;
    setIsScoring(true);
    // Mirrors ResumeWorkspace's real scoring flow: a brief request delay, then the score lands
    // and CountUp animates it in - mounting straight at 82 would just jump there with no motion.
    setTimeout(() => {
      setScore(0);
      setTimeout(() => {
        setScore(82);
        setIsScoring(false);
      }, 60);
    }, 700);
  }

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
              This is your actual resume workspace &mdash; click any bullet to see the real experience it came from.
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

        {/* Resume workspace, matching the real product's layout */}
        <div className="mt-10 mx-auto max-w-3xl rounded-lg border border-border bg-surface p-5 shadow-pop sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex gap-2">
              <Button type="button" variant={tab === "resume" ? "primary" : "outline"} size="sm" onClick={() => setTab("resume")}>
                Resume
              </Button>
              <Button
                type="button"
                variant={tab === "cover-letter" ? "primary" : "outline"}
                size="sm"
                onClick={() => setTab("cover-letter")}
              >
                Cover letter
              </Button>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleScore} isLoading={isScoring}>
                {score !== null ? "Re-score resume" : "Score resume"}
              </Button>
              <Button type="button" size="sm">
                Download &#9662;
              </Button>
            </div>
          </div>

          {tab === "resume" ? (
            <div className="mt-5">
              {score !== null ? (
                <ATSScore score={score} missingKeywords={["Power BI"]} />
              ) : (
                <p className="text-xs text-ink-muted">Click &ldquo;Score resume&rdquo; to see your ATS match.</p>
              )}

              <div className="mt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Professional Experience &mdash; click a bullet to see its source
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {RESUME_BULLETS.map((bullet) => {
                    const isSelected = bullet.id === selectedBulletId;
                    return (
                      <button
                        key={bullet.id}
                        type="button"
                        onClick={() => setSelectedBulletId(bullet.id)}
                        className={`rounded p-3 text-left text-sm transition-all hover:-translate-y-0.5 ${
                          isSelected ? "bg-accent-soft" : "bg-paper-deep hover:bg-accent-soft/40"
                        }`}
                      >
                        <p className="text-ink">&bull; {bullet.text}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 rounded border border-border bg-paper p-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    What you told us:
                  </span>
                  <p className="mt-1 text-xs italic text-ink">&ldquo;{activeBullet.sourceExp}&rdquo;</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Cover letter (opening paragraph)
              </p>
              <p className="mt-3 text-sm italic text-ink leading-relaxed">
                &ldquo;{COVER_LETTER_SNIPPET}&rdquo;
              </p>
              <p className="mt-3 text-xs text-ink-muted">
                Drawn from the same evidence as your resume &mdash; nothing new invented.
              </p>
            </div>
          )}
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
