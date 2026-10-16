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
          <h2>Not ready to sign up? Score the resume you have now.</h2>
          <p className="lead">
            Upload it and get a score out of 100 in about {TIMINGS.resumeScoreSeconds} seconds, with what to fix first. Your score is free and needs no account.
          </p>
        </div>
        <div className="reveal">
          <PublicResumeScorer />
        </div>
      </div>
    </section>
  );
}
