"use client";

export function AustraliaSection() {
  return (
    <section className="section" id="why">
      <div className="container">
        <div className="feature-row reverse">
          <div className="media reveal">
            <div className="stagger" style={{ display: "grid", gap: "12px" }}>
              <div className="card" style={{ padding: "16px" }}>
                <b style={{ color: "var(--ink)" }}>100% Australian English</b>
                <br />
                <small style={{ color: "var(--muted)" }}>
                  organised, prioritised, behaviour &mdash; zero Americanisms.
                </small>
              </div>
              <div className="card" style={{ padding: "16px" }}>
                <b style={{ color: "var(--ink)" }}>Australian ATS standards</b>
                <br />
                <small style={{ color: "var(--muted)" }}>
                  04xx phone layout, AU work rights, no profile photos.
                </small>
              </div>
              <div className="card" style={{ padding: "16px" }}>
                <b style={{ color: "var(--ink)" }}>Built for SEEK &amp; local portals</b>
                <br />
                <small style={{ color: "var(--muted)" }}>
                  Tuned to the ATS systems ASX 200, uni, and gov employers use.
                </small>
              </div>
            </div>
          </div>
          <div className="reveal">
            <span className="eyebrow">The Australian hiring edge</span>
            <h2 style={{ margin: "16px 0 16px" }}>
              Built for how Australia actually hires.
            </h2>
            <p className="lead">
              Overseas AI tools default to US conventions, American spellings, and exaggerated metrics that Australian hiring managers immediately discard. ApplyLab doesn&apos;t.
            </p>
            <ul className="feature-list">
              <li>
                <span className="tick">✓</span>
                <span>Panel-ready: every claim is defensible under specific questioning.</span>
              </li>
              <li>
                <span className="tick">✓</span>
                <span>Honest gaps flagged, not covered up.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
