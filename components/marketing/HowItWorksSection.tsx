"use client";

import { CTA, HOW_IT_WORKS } from "@/lib/marketing/copy";

export function HowItWorksSection() {
  return (
    <section className="section tint" id="how">
      <div className="container center">
        <h2 className="reveal" style={{ margin: "0 0 14px" }}>
          How ApplyLab works
        </h2>
        <p className="lead reveal">
          Three steps. Your experience goes in once, and every resume after that is built from it.
        </p>
        <div className="card-grid cols-3 stagger" style={{ marginTop: "44px", textAlign: "left" }}>
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.title} className="card" style={{ padding: "26px" }}>
              <div className="pill">Step {i + 1}</div>
              <h3 style={{ margin: "6px 0 8px" }}>{step.title}</h3>
              <p style={{ fontSize: "0.95rem" }}>{step.body}</p>
            </div>
          ))}
        </div>
        <div className="section-cta reveal">
          <a className="btn btn-primary" href="#score">
            {CTA.primary} &rarr;
          </a>
        </div>
      </div>
    </section>
  );
}
