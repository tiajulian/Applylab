"use client";

import { useState } from "react";
import Link from "next/link";
import { clsx } from "@/lib/utils";
import { RotateCwIcon } from "@/components/ui/icons/LucideIcons";
import { StandOutDemo } from "@/components/marketing/StandOutDemo";

// Each item matches a step of the demo card and highlights while that step plays.
const STEPS = [
  { title: "Pick the tasks you did", body: "We suggest common tasks for your job. Tick the ones that are true." },
  { title: "Add what changed", body: "Answer two quick questions. Add a number only if you know it." },
  { title: "Choose your new bullet", body: "AI writes it three ways. Pick the one you like." },
];

export function StandOutSection() {
  // 0 before the demo starts, 1-3 while a step plays, 4 when it has finished.
  const [activeStep, setActiveStep] = useState(0);
  const [replays, setReplays] = useState(0);
  const playing = activeStep > 0 && activeStep < 4;

  return (
    <section className="section" id="stand-out" data-section="stand-out">
      {/* The old anchor, so earlier links to #fact-checked still land on this section. */}
      <span id="fact-checked" />
      <div className="container">
        <div className="so-row">
          <div className="reveal">
            <span className="eyebrow">Then improve it</span>
            <h2 className="feature-title so-title">Show employers what you achieved, not just what you did.</h2>
            <p className="lead">
              Most resumes only list duties. ApplyLab turns yours into clear results employers notice, in three simple steps.
            </p>
            <ol className={clsx("so-steps", playing && "is-playing")}>
              {STEPS.map((step, i) => (
                <li key={step.title} className={clsx(activeStep === i + 1 && "is-active")}>
                  <span className="so-num" aria-hidden="true">{i + 1}</span>
                  <span>
                    <strong>{step.title}</strong>
                    <small>{step.body}</small>
                  </span>
                </li>
              ))}
            </ol>
            <div className="so-ctas">
              <Link className="btn btn-primary" href="/onboarding" data-cta="standout-strengthen">
                Strengthen my resume &rarr;
              </Link>
              <button type="button" className="btn btn-ghost so-replay" aria-label="Replay demo" onClick={() => setReplays((n) => n + 1)}>
                <RotateCwIcon className="h-4 w-4" aria-hidden="true" /> Replay
              </button>
            </div>
          </div>

          <div className="reveal">
            <StandOutDemo replays={replays} onStepChange={setActiveStep} />
            <p className="so-honest">We never invent a number. If you don&apos;t have one, a clear outcome works too.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
