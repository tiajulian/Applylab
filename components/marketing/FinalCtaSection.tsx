"use client";

import Link from "next/link";
import { CTA } from "@/lib/marketing/copy";
import { FREE_RESUMES_LABEL } from "@/lib/marketing/plans";

export function FinalCtaSection() {
  return (
    <section className="section" data-section="final">
      <div className="container">
        <div className="cta-band reveal">
          <h2>Prepare for your next interview with confidence.</h2>
          <p>Get a tailored resume for the job, then practise the interview out loud before the real one.</p>
          <div className="section-cta">
            <Link className="btn btn-primary" href="/onboarding" data-cta="final-start-free">
              {CTA.startFree} &rarr;
            </Link>
            <a className="btn btn-ghost" href="#score" data-cta="final-score">
              {CTA.scoreFree} &rarr;
            </a>
          </div>
          <p className="cta-fineprint">
            {FREE_RESUMES_LABEL} free &middot; No credit card &middot; Australian English
          </p>
        </div>
      </div>
    </section>
  );
}
