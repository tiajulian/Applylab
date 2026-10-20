"use client";

import { PublicResumeScorer } from "@/components/marketing/PublicResumeScorer";
import { TIMINGS } from "@/lib/marketing/copy";

// The smallest ask on the page (no account, about 30 seconds), so it sits right after the hero:
// the first thing people reach when they scroll.
export function FreeResumeScoreSection() {
  return (
    <section className="section score-section" id="score" data-section="score">
      <div className="container score-grid">
        <div className="reveal">
          <h2>How does your resume score? Find out free.</h2>
          <p className="lead">
            Upload your resume and get a score out of 100 in about {TIMINGS.resumeScoreSeconds} seconds, with what to fix first. No account needed.
          </p>
        </div>
        <div className="reveal">
          <PublicResumeScorer improveHref="#stand-out" />
        </div>
      </div>
    </section>
  );
}
