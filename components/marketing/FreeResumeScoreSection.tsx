"use client";

import { PublicResumeScorer } from "@/components/marketing/PublicResumeScorer";
import { TIMINGS } from "@/lib/marketing/copy";

// A side door, not the front door: the home page leads with tailoring, and this is for visitors
// who want to check their current resume before signing up.
export function FreeResumeScoreSection() {
  return (
    <section className="section" id="score">
      <div className="container score-grid">
        <div className="reveal">
          <h2>How does your resume score? Find out free.</h2>
          <p className="lead">
            Upload your resume and get a score out of 100 in about {TIMINGS.resumeScoreSeconds} seconds, with what to fix first. No account needed.
          </p>
        </div>
        <div className="reveal">
          <PublicResumeScorer />
        </div>
      </div>
    </section>
  );
}
