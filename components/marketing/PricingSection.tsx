"use client";

import Link from "next/link";
import { CheckIcon } from "@/components/ui/icons/LucideIcons";

export function PricingSection() {
  return (
    <section className="section tint" id="pricing">
      <div className="container center">
        <span className="eyebrow reveal">Simple, transparent pricing</span>
        <h2 className="reveal" style={{ margin: "16px 0 14px" }}>
          Start free. Upgrade when you need unlimited power.
        </h2>
        <p className="lead reveal">
          Test the full matching, tailoring, and extension engine free. No credit card required.
        </p>
        <div className="prices stagger">
          {/* Free Tier */}
          <div className="price">
            <div className="plan">Free</div>
            <div className="sub">No card required</div>
            <div className="amt">
              $0 <small>AUD forever</small>
            </div>
            <ul>
              <li>
                <span className="tick"><CheckIcon /></span>2 complete tailored applications
              </li>
              <li>
                <span className="tick"><CheckIcon /></span>Single verified profile
              </li>
              <li>
                <span className="tick"><CheckIcon /></span>Unlimited AU job matching
              </li>
              <li>
                <span className="tick"><CheckIcon /></span>1-click extension autofill
              </li>
            </ul>
            <Link className="btn btn-ghost" href="/onboarding">
              Start free &rarr;
            </Link>
          </div>

          {/* Pro Copilot Tier */}
          <div className="price pop">
            <span className="badge">Most popular</span>
            <div className="plan">Pro Copilot</div>
            <div className="sub">Complete toolkit</div>
            <div className="amt">
              $19 <small>AUD / month</small>
            </div>
            <ul>
              <li>
                <span className="tick"><CheckIcon /></span>Unlimited resumes &amp; cover letters
              </li>
              <li>
                <span className="tick"><CheckIcon /></span>AI voice STAR interview coach
              </li>
              <li>
                <span className="tick"><CheckIcon /></span>PDF &amp; editable Word export
              </li>
              <li>
                <span className="tick"><CheckIcon /></span>Kanban tracker &amp; priority support
              </li>
              <li>
                <span className="tick"><CheckIcon /></span>All 8 ATS-safe templates
              </li>
            </ul>
            <Link className="btn btn-primary" href="/onboarding">
              Start free, upgrade anytime &rarr;
            </Link>
          </div>

          {/* Single Unlock Tier */}
          <div className="price">
            <div className="plan">Single unlock</div>
            <div className="sub">One-off</div>
            <div className="amt">
              $2.99 <small>AUD once</small>
            </div>
            <ul>
              <li>
                <span className="tick"><CheckIcon /></span>One tailored resume
              </li>
              <li>
                <span className="tick"><CheckIcon /></span>PDF and Word .docx
              </li>
              <li>
                <span className="tick"><CheckIcon /></span>Yours to keep, no subscription
              </li>
            </ul>
            <Link className="btn btn-ghost" href="/onboarding">
              Get single unlock &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
