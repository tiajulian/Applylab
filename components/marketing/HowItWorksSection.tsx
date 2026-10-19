"use client";

import Link from "next/link";
import { FileTextIcon, MicIcon, RotateCwIcon, UserIcon, WandSparklesIcon } from "@/components/ui/icons/LucideIcons";
import { APPLY_LOOP, CTA, HOME } from "@/lib/marketing/copy";

const REPEAT_ICONS = [FileTextIcon, WandSparklesIcon, MicIcon];

export function HowItWorksSection() {
  return (
    <section className="section loop-section" id="how">
      <div className="container">
        <div className="loop-head reveal">
          <span className="eyebrow">How it works</span>
          <h2>{HOME.loopHeadline}</h2>
          <p className="lead">Everything you need to apply with confidence, in one place.</p>
        </div>

        <div className="loop-grid">
          <div className="loop-once reveal">
            <span className="loop-label">Once</span>
            <span className="loop-icon" aria-hidden="true"><UserIcon className="h-5 w-5" /></span>
            <h3>{APPLY_LOOP.once.title}</h3>
            <p>{APPLY_LOOP.once.body}</p>
          </div>

          <div className="loop-repeat reveal">
            <span className="loop-label">
              <RotateCwIcon className="h-3.5 w-3.5" aria-hidden="true" /> For every job
            </span>
            <ol className="loop-steps stagger">
              {APPLY_LOOP.repeat.map((step, i) => {
                const Icon = REPEAT_ICONS[i];
                return (
                  <li key={step.title}>
                    <span className="loop-icon" aria-hidden="true"><Icon className="h-5 w-5" /></span>
                    <span className="loop-step-tag">{step.tag}</span>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <div className="loop-cta reveal">
          <Link className="btn btn-primary" href="/onboarding">
            {CTA.startFree} &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
