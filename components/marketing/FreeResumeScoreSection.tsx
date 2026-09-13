"use client";

import { PublicResumeScorer } from "@/components/marketing/PublicResumeScorer";

export function FreeResumeScoreSection() {
  return (
    <section className="section tint" id="score">
      <div className="container center">
        <span className="eyebrow reveal">Free Resume Diagnostic</span>
        <h2 className="reveal" style={{ margin: "16px 0 14px" }}>
          Score your existing resume in 30 seconds.
        </h2>
        <p className="lead reveal" style={{ marginBottom: "36px" }}>
          Upload your PDF or Word resume to see how Australian ATS parsers read it. Inspect formatting errors, weak verbs, and missing metrics free with zero obligation.
        </p>

        <div className="reveal" style={{ maxWidth: "680px", margin: "0 auto", textAlign: "left" }}>
          <PublicResumeScorer />
        </div>
      </div>
    </section>
  );
}
