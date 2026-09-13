"use client";

export function FinalCtaSection() {
  return (
    <section className="section">
      <div className="container">
        <div className="cta-band reveal">
          <h2>Resumes you can defend in an Australian interview.</h2>
          <p>
            Build your verified profile once. Generate ATS-safe tailored resumes, autofill portals on SEEK, and walk in prepared.
          </p>
          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            <a className="btn btn-primary" href="#score">
              Score your resume free &rarr;
            </a>
          </div>
          <p style={{ marginTop: "16px", fontSize: "0.9rem" }}>
            2 applications free &middot; No credit card required &middot; 100% Australian English
          </p>
        </div>
      </div>
    </section>
  );
}
