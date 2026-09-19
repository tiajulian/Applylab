"use client";

import { CheckIcon, StarIcon, WandSparklesIcon } from "@/components/ui/icons/LucideIcons";

import Link from "next/link";

export function HeroSection() {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="reveal">
          <span className="eyebrow">Built for the Australian job market 🇦🇺</span>
          <h1>Resumes you can actually defend.</h1>
          <p className="lead">
            Stop pasting generic AI text that invents achievements and falls apart in interviews. ApplyLab grounds every bullet, cover letter, and interview answer in your verified career history.
          </p>
          <div className="hero-cta">
            <a className="btn btn-primary" href="#score">
              Score your resume free &rarr;
            </a>
            <Link className="btn btn-ghost" href="/onboarding">
              Build your full profile &rarr;
            </Link>
          </div>
          <p className="hero-fineprint">
            Free score takes an existing resume. Matching needs your full profile.
          </p>
          <div className="trust">
            <span className="stars"><StarIcon className="inline h-3.5 w-3.5 align-text-bottom" /> 4.8</span>
            <span>Chrome rating</span>
            <span className="sep" />
            <span>
              <b style={{ color: "var(--ink)" }}>3,400+</b> job seekers in Australia
            </span>
          </div>
        </div>

        {/* CSS product collage (Original ApplyLab content, GPU-floated) */}
        <div className="collage reveal">
          <div className="card match-card float">
            <div className="browser-bar">
              <b />
              <b />
              <b />
              &nbsp; applylab.au/match/rosterly-analyst
            </div>
            <div className="match-head">
              <div>
                <p className="pill">Target Job Match</p>
                <h3>Implementation Analyst</h3>
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
                <small>Verified duty &middot; Venue Manager, Marlowe Hospitality</small>
              </div>
            </div>
            <div className="evline">
              <span className="tick"><CheckIcon /></span>
              <div>
                Stakeholder Management &amp; Training
                <small>Verified duty &middot; Marlowe Hospitality, 2019&ndash;2024</small>
              </div>
            </div>
            <div className="evline">
              <span className="part">◐</span>
              <div>
                Data Analysis &amp; Excel Reporting
                <small>Phrased as transferable skill, never as unverified experience</small>
              </div>
            </div>
          </div>
          <div className="card mini-card mini-1 float d1">
            <span className="tick"><CheckIcon /></span> <b>6</b> backed by evidence
          </div>
          <div className="card mini-card mini-2 float d2">
            <WandSparklesIcon className="inline h-4 w-4 align-text-bottom" /> Autofills in <b>1.4s</b>
          </div>
        </div>
      </div>
    </section>
  );
}
