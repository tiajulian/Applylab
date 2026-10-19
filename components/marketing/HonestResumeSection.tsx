"use client";

import { CheckIcon } from "@/components/ui/icons/LucideIcons";

// Keeps the #fact-checked anchor so existing links (nav, blog) still land here.
export function HonestResumeSection() {
  return (
    <section className="section tint" id="fact-checked">
      <div className="container">
        <div className="feature-row">
          <div className="reveal">
            <span className="eyebrow">Why people trust ApplyLab</span>
            <h2 className="feature-title">Every line comes from your real experience.</h2>
            <p className="lead">
              Generic AI tools often invent skills and results you can&apos;t support in an interview. ApplyLab only uses the experience you&apos;ve added. If a role asks for something you don&apos;t have, we show you the gap instead of filling it with claims.
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
                Operations professional moving into implementation analysis, with 5 years improving how Melbourne venues run.
                <span className="src-tag is-transfer">Transferable skill</span>
              </p>
              <div className="rsec">Venue Manager &middot; Marlowe Hospitality &middot; 2019&ndash;2024</div>
              <ul>
                <li>
                  Led POS and inventory rollouts, cutting onboarding time by 30%.
                  <span className="src-tag">From your profile</span>
                </li>
                <li>
                  Supervised 9 shift supervisors across weekend trading.
                  <span className="src-tag">From your profile</span>
                </li>
              </ul>
              <div className="flag">
                <b>Gap: worth learning.</b> The ad asks for SQL. It&apos;s not in your profile, so it stays off your resume.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
