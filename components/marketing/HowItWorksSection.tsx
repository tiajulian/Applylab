"use client";

export function HowItWorksSection() {
  return (
    <section className="section tint" id="how">
      <div className="container center">
        <span className="eyebrow reveal">How it works</span>
        <h2 className="reveal" style={{ margin: "16px 0 14px" }}>
          Three steps to an application you can defend.
        </h2>
        <p className="lead reveal">
          No endless re-prompting, no fabricated achievements, no copy-paste marathons across job portals.
        </p>
        <div className="card-grid cols-3 stagger" style={{ marginTop: "44px", textAlign: "left" }}>
          <div className="card" style={{ padding: "26px" }}>
            <div className="pill">Step 1</div>
            <h3 style={{ margin: "6px 0 8px" }}>Build your verified profile</h3>
            <p style={{ fontSize: "0.95rem" }}>
              Add your history, duties, tools, and quantified wins once. This record powers every application.
            </p>
          </div>
          <div className="card" style={{ padding: "26px" }}>
            <div className="pill">Step 2</div>
            <h3 style={{ margin: "6px 0 8px" }}>Match and tailor to the role</h3>
            <p style={{ fontSize: "0.95rem" }}>
              Paste any SEEK or LinkedIn ad. ApplyLab maps evidence, flags gaps, and builds a strict 1-page resume.
            </p>
          </div>
          <div className="card" style={{ padding: "26px" }}>
            <div className="pill">Step 3</div>
            <h3 style={{ margin: "6px 0 8px" }}>Apply and walk in prepared</h3>
            <p style={{ fontSize: "0.95rem" }}>
              Autofill portals with the Chrome extension, log the role to your Kanban board, and drill interview questions.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
