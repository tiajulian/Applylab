"use client";

import { PublicResumeScorer } from "@/components/marketing/PublicResumeScorer";
import { TIMINGS } from "@/lib/marketing/copy";

export function FreeResumeScoreSection() {
  return (
    <section className="section tint" id="score">
      <div className="container center">
        <h2 className="reveal" style={{ margin: "0 0 14px" }}>
          See how strong your resume is, free.
        </h2>
        <p className="lead reveal" style={{ marginBottom: "36px" }}>
          Upload your resume and get a score out of 100 in about {TIMINGS.resumeScoreSeconds} seconds, with what to fix first.
        </p>

        <div className="reveal" style={{ maxWidth: "680px", margin: "0 auto", textAlign: "left" }}>
          <PublicResumeScorer />
        </div>
      </div>
    </section>
  );
}
