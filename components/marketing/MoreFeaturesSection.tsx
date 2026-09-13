"use client";

export function MoreFeaturesSection() {
  return (
    <section className="section" id="more">
      <div className="container center">
        <span className="eyebrow reveal">And it also does this</span>
        <h2 className="reveal" style={{ margin: "16px auto 14px", maxWidth: "24ch" }}>
          Autofill the forms, nail the interview, track to offer.
        </h2>
        <p className="lead reveal">
          Once your profile is verified, ApplyLab handles the repetitive application chores and prepares you for Australian panel interviews.
        </p>
      </div>

      <div className="container" style={{ marginTop: "56px" }}>
        {/* Chrome Extension */}
        <div className="feature-row" id="extension">
          <div className="reveal">
            <span className="eyebrow">Chrome extension</span>
            <h2 style={{ margin: "16px 0 16px" }}>
              Skip the copy-paste marathon on Workday and SEEK.
            </h2>
            <p className="lead">
              Applying in Australia usually means retyping your work history twenty times. The extension detects application forms, fills your Australian details, and attaches your tailored PDF in one click.
            </p>
            <ul className="feature-list">
              <li>
                <span className="tick">✓</span>
                <span>04xx mobile and AU residency formatting.</span>
              </li>
              <li>
                <span className="tick">✓</span>
                <span>Direct PDF attach &mdash; no drag-and-drop.</span>
              </li>
              <li>
                <span className="tick">✓</span>
                <span>Auto-logs company, salary, and job ad to your board.</span>
              </li>
            </ul>
          </div>
          <div className="media reveal">
            <div className="browser-bar">
              <b />
              <b />
              <b />
              &nbsp; canva.wd3.myworkdayjobs.com/apply
            </div>
            <p className="pill" style={{ marginTop: 0 }}>
              Product Analyst &middot; Sydney NSW &middot; Step 2 of 4
            </p>
            <div className="field req">
              <b>Mobile phone (Australia)</b>0412 000 000
            </div>
            <div className="field">
              <b>AU work rights</b>Australian citizen
            </div>
            <div className="field">
              <b>Attach resume</b>priya-nair-analyst.pdf
            </div>
            <button className="autofill-btn" type="button">
              ⚡ Autofill &middot; 1.4s
            </button>
          </div>
        </div>

        {/* Cover Letters */}
        <div className="feature-row reverse" id="cover-letters">
          <div className="media reveal">
            <p className="pill" style={{ marginTop: 0 }}>
              Cover letter &middot; grounded AU English
            </p>
            <div className="letter">
              <div className="l" style={{ width: "42%" }} />
              <div className="l hl" style={{ width: "92%" }} />
              <div className="l" style={{ width: "86%" }} />
              <div className="l hl" style={{ width: "78%" }} />
              <div className="l" style={{ width: "95%" }} />
              <div className="l" style={{ width: "68%" }} />
            </div>
          </div>
          <div className="reveal">
            <span className="eyebrow">Cover letters</span>
            <h2 style={{ margin: "16px 0 16px" }}>
              One click from your tailored resume.
            </h2>
            <p className="lead">
              Grounded in the exact same verified evidence chain. Matches the company&apos;s tone and the job&apos;s requirements &mdash; without robotic filler or fake claims.
            </p>
            <ul className="feature-list">
              <li>
                <span className="tick">✓</span>
                <span>Builds on your resume instead of repeating it.</span>
              </li>
              <li>
                <span className="tick">✓</span>
                <span>A fresh, tailored letter for every application.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Interview Coach */}
        <div className="feature-row" id="interview">
          <div className="reveal">
            <span className="eyebrow">AI interview coach</span>
            <h2 style={{ margin: "16px 0 16px" }}>
              Voice or text, scored live on STAR.
            </h2>
            <p className="lead">
              Practise role-specific behavioural and technical questions with turn-by-turn feedback on Situation, Task, Action, and Result &mdash; calibrated for Australian panels.
            </p>
            <ul className="feature-list">
              <li>
                <span className="tick">✓</span>
                <span>Realistic phone-screen, panel, and behavioural rounds.</span>
              </li>
              <li>
                <span className="tick">✓</span>
                <span>Audio transcribed and scored live, never stored.</span>
              </li>
            </ul>
          </div>
          <div className="media reveal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span className="pill" style={{ margin: 0 }}>
                STAR scorecard
              </span>
              <span className="score-big">
                92<small style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: 500 }}>/100</small>
              </span>
            </div>
            <div className="star">
              <div className="row">
                <span>Situation</span>
                <div className="bar">
                  <i style={{ width: "95%" }} />
                </div>
                <span>95</span>
              </div>
              <div className="row">
                <span>Task</span>
                <div className="bar">
                  <i style={{ width: "88%" }} />
                </div>
                <span>88</span>
              </div>
              <div className="row">
                <span>Action</span>
                <div className="bar">
                  <i style={{ width: "90%" }} />
                </div>
                <span>90</span>
              </div>
              <div className="row">
                <span>Result</span>
                <div className="bar">
                  <i style={{ width: "96%" }} />
                </div>
                <span>96</span>
              </div>
            </div>
          </div>
        </div>

        {/* Application Tracker */}
        <div className="feature-row reverse" id="tracker">
          <div className="media reveal">
            <p className="pill" style={{ marginTop: 0 }}>
              Application tracker &middot; auto-sync
            </p>
            <div className="kanban" style={{ marginTop: "12px" }}>
              <div className="kcol">
                <h4>Applied</h4>
                <div className="kcard">
                  Product Analyst<small>Canva &middot; Sydney</small>
                </div>
                <div className="kcard">
                  Ops Analyst<small>Atlassian</small>
                </div>
              </div>
              <div className="kcol">
                <h4>Interviewing</h4>
                <div className="kcard">
                  Impl. Analyst<small>Rosterly &middot; Rd 2</small>
                </div>
              </div>
              <div className="kcol">
                <h4>Offer</h4>
                <div className="kcard">
                  Data Analyst<small>Telstra 🎉</small>
                </div>
              </div>
            </div>
          </div>
          <div className="reveal">
            <span className="eyebrow">Application tracker</span>
            <h2 style={{ margin: "16px 0 16px" }}>
              Applied, interviewing, offer.
            </h2>
            <p className="lead">
              A connected Kanban board that keeps job ads, tailored resumes, recruiter notes, and interview prep in one workspace &mdash; synced automatically from the extension.
            </p>
            <ul className="feature-list">
              <li>
                <span className="tick">✓</span>
                <span>Captures dates, titles, companies, and salary bands.</span>
              </li>
              <li>
                <span className="tick">✓</span>
                <span>Drag and drop through every stage.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
