"use client";

import { BRAND, CTA, TIMINGS } from "@/lib/marketing/copy";
import { FREE_RESUMES_LABEL } from "@/lib/marketing/plans";

export function FinalCtaSection() {
  return (
    <section className="section">
      <div className="container">
        <div className="cta-band reveal">
          <h2>Your next resume, tailored in {TIMINGS.tailorSeconds} seconds.</h2>
          <p>{BRAND.oneLiner}</p>
          <div className="section-cta">
            <a className="btn btn-primary" href="#score">
              {CTA.primary} &rarr;
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
