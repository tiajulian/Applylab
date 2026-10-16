"use client";

import { CheckIcon } from "@/components/ui/icons/LucideIcons";

// File keeps its old name so git history follows it; the section is "Fact-checked resume" now.
export function TraceableResumeSection() {
  return (
    <section className="section" id="fact-checked">
      <div className="container">
        <div className="feature-row">
          <div className="reveal">
            <h2 style={{ margin: "0 0 16px" }}>
              Fast, but nothing made up.
            </h2>
            <p className="lead">
              Applying at volume is no excuse for a resume you can&apos;t back up. Other AI tools invent numbers to sound impressive. ApplyLab checks every line against your profile and flags anything that doesn&apos;t match, so you&apos;re never caught out in an interview.
            </p>
            <ul className="feature-list">
              <li>
                <span className="tick"><CheckIcon /></span>
                <span>Fits on one page, in the format Australian employers expect.</span>
              </li>
              <li>
                <span className="tick"><CheckIcon /></span>
                <span>Flags any number or claim that isn&apos;t in your profile.</span>
              </li>
              <li>
                <span className="tick"><CheckIcon /></span>
                <span>You approve every change before you download.</span>
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
                <b>Mismatch found:</b> your profile says 9 supervisors, this line said 14. Fixed to 9.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
