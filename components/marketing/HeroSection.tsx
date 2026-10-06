"use client";

import { CheckIcon, WandSparklesIcon } from "@/components/ui/icons/LucideIcons";
import { BRAND, CTA } from "@/lib/marketing/copy";

export function HeroSection() {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="reveal">
          <span className="eyebrow">Built for the Australian job market 🇦🇺</span>
          <h1>{BRAND.headline}</h1>
          <p className="lead">
            Paste a SEEK or LinkedIn job ad. ApplyLab rewrites your resume to match it, using only your real experience, so every line holds up in an interview.
          </p>
          <div className="hero-cta">
            <a className="btn btn-primary" href="#score">
              {CTA.primary} &rarr;
            </a>
            <a className="text-link" href="#how">or see how it works</a>
          </div>
          <p className="hero-fineprint">
            Free to start &middot; No credit card &middot; Australian English
          </p>
        </div>

        {/* CSS product collage (Original ApplyLab content, GPU-floated) */}
        <div className="collage reveal">
          <div className="card match-card float">
            <div className="browser-bar">
              <b />
              <b />
              <b />
              &nbsp; applylab.io/fit/rosterly-analyst
            </div>
            <div className="match-head">
              <div>
                <p className="pill">Your fit for this job</p>
                <p className="match-title">Implementation Analyst</p>
                <small style={{ color: "var(--muted)" }}>
                  Rosterly &middot; Cremorne VIC &middot; pasted from SEEK
                </small>
              </div>
              <div className="score-ring">
                <span>82</span>
              </div>
            </div>
            <div className="evline">
              <span className="tick"><CheckIcon /></span>
              <div>
                Workflow Optimisation &amp; System Rollouts
                <small>From your profile &middot; Venue Manager, Marlowe Hospitality</small>
              </div>
            </div>
            <div className="evline">
              <span className="tick"><CheckIcon /></span>
              <div>
                Stakeholder Management &amp; Training
                <small>From your profile &middot; Marlowe Hospitality, 2019&ndash;2024</small>
              </div>
            </div>
            <div className="evline">
              <span className="part">◐</span>
              <div>
                Data Analysis &amp; Excel Reporting
                <small>Shown as a transferable skill, never as experience you don&apos;t have</small>
              </div>
            </div>
          </div>
          <div className="card mini-card mini-1 float d1">
            <span className="tick"><CheckIcon /></span> <b>6</b> from your real experience
          </div>
          <div className="card mini-card mini-2 float d2">
            <WandSparklesIcon className="inline h-4 w-4 align-text-bottom" /> Fills in the <b>SEEK</b> form
          </div>
        </div>
      </div>
    </section>
  );
}
