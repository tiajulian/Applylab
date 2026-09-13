"use client";

export function ComparisonSection() {
  return (
    <section className="section">
      <div className="container center">
        <span className="eyebrow reveal">Why not ChatGPT</span>
        <h2 className="reveal" style={{ margin: "16px auto 14px", maxWidth: "22ch" }}>
          ChatGPT is a blank box. ApplyLab is a job-search copilot.
        </h2>
        <div className="compare reveal" style={{ textAlign: "left" }}>
          <div className="col-head">Job search aspect</div>
          <div className="col-head hide-m">Generic ChatGPT</div>
          <div className="col-head us">ApplyLab</div>

          <div className="rowlabel">Career history</div>
          <div className="cross hide-m">Re-paste your CV every new chat.</div>
          <div className="us-cell check">Verified profile powers every application.</div>

          <div className="rowlabel">Job matching</div>
          <div className="cross hide-m">Invents skills to force a match.</div>
          <div className="us-cell check">Evidence-backed matches, honest gaps.</div>

          <div className="rowlabel">Applying</div>
          <div className="cross hide-m">Copy-paste field by field.</div>
          <div className="us-cell check">1-click autofill on SEEK &amp; Workday.</div>

          <div className="rowlabel" style={{ borderBottom: 0 }}>Australian fit</div>
          <div className="cross hide-m" style={{ borderBottom: 0 }}>US English and formatting.</div>
          <div className="us-cell check" style={{ borderBottom: 0 }}>AU English, 04xx, strict 1-page.</div>
        </div>
      </div>
    </section>
  );
}
