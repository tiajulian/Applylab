"use client";

import Link from "next/link";
import { CTA } from "@/lib/marketing/copy";
import { FREE_RESUMES_LABEL } from "@/lib/marketing/plans";

export function FinalCtaSection() {
  return (
    <section className="section">
      <div className="container">
        <div className="cta-band reveal">
          <h2>Spend tonight applying, not rewriting.</h2>
          <p>Add your experience once, then get a tailored resume for every job ad you paste.</p>
          <div className="section-cta">
            <Link className="btn btn-primary" href="/onboarding">
              {CTA.tailor} &rarr;
            </Link>
          </div>
          <p className="cta-fineprint">
            {FREE_RESUMES_LABEL} free &middot; No credit card &middot; Australian English
          </p>
        </div>
      </div>
    </section>
  );
}
