"use client";

import { CheckIcon } from "@/components/ui/icons/LucideIcons";

export function TraceableResumeSection() {
  return (
    <section className="section tint" id="traceable">
      <div className="container">
        <div className="feature-row">
          <div className="reveal">
            <span className="eyebrow">The Traceable Resume</span>
            <h2 style={{ margin: "16px 0 16px" }}>
              Every line traces to something you actually did.
            </h2>
            <p className="lead">
              The biggest fear in job hunting is getting caught out on a claim you can&apos;t defend. Generic tools invent metrics to beat keyword filters. ApplyLab keeps every claim tethered to your verified evidence chain.
            </p>
            <ul className="feature-list">
              <li>
                <span className="tick"><CheckIcon /></span>
                <span>Strict 1-page Australian ATS layout with automatic line budgeting.</span>
              </li>
              <li>
                <span className="tick"><CheckIcon /></span>
                <span>Fixes limited to align, remove, or add verified evidence &mdash; never fabricate.</span>
              </li>
              <li>
                <span className="tick"><CheckIcon /></span>
                <span>Zero hallucinations, so you walk into panel interviews confident.</span>
              </li>
            </ul>
          </div>
          <div className="media reveal">
            <div className="resume">
              <div className="rname">Priya Nair</div>
              <div className="rmeta">Cremorne VIC &middot; 0412 663 208 &middot; Full AU work rights</div>
              <div className="rsec">Professional summary</div>
              <p>
                Operations professional moving into Implementation Analysis, with 5+ years optimising workflow protocols across Melbourne venues.
              </p>
              <div className="rsec">Venue Manager &middot; Marlowe Hospitality &middot; 2019&ndash;2024</div>
              <ul>
                <li>Led POS and inventory rollouts, cutting onboarding cycle times by 30%.</li>
                <li>Directly supervised shift supervisors across weekend trading.</li>
              </ul>
              <div className="flag">
                <b>Discrepancy caught:</b> profile says 9 supervisors &mdash; drafted line claimed 14. Auto-aligning&hellip;
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
