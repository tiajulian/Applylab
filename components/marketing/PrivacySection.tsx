"use client";

export function PrivacySection() {
  return (
    <section className="section tint" id="privacy">
      <div className="container center">
        <span className="eyebrow reveal">Your data and privacy</span>
        <h2 className="reveal" style={{ margin: "16px auto 14px", maxWidth: "26ch" }}>
          Your career data belongs to you, not an AI training pool.
        </h2>
        <p className="lead reveal">
          Installing an extension and uploading resumes takes trust. Here&apos;s exactly how your career history is protected.
        </p>
        <div className="card-grid cols-4 stagger" style={{ marginTop: "44px", textAlign: "left" }}>
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ marginBottom: "8px" }}>Stored in Australia</h3>
            <p style={{ fontSize: "0.92rem" }}>
              Your profile and resumes are encrypted and stored in Australia. Never sold, never used to train public AI models.
            </p>
          </div>
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ marginBottom: "8px" }}>Audio discarded</h3>
            <p style={{ fontSize: "0.92rem" }}>
              Interview speech is transcribed and scored live. Recordings are never retained on our servers.
            </p>
          </div>
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ marginBottom: "8px" }}>Zero auto-apply</h3>
            <p style={{ fontSize: "0.92rem" }}>
              The extension never auto-submits. No spray-and-pray mode. You stay in control of every application.
            </p>
          </div>
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ marginBottom: "8px" }}>Instant deletion</h3>
            <p style={{ fontSize: "0.92rem" }}>
              Delete your account in one click. Profile, applications, and cached tokens are purged immediately.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
