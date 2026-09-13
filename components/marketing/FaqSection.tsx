"use client";

export function FaqSection() {
  return (
    <section className="section" id="faq">
      <div className="container center">
        <span className="eyebrow reveal">FAQ</span>
        <h2 className="reveal" style={{ margin: "16px 0 4px" }}>
          Questions, answered honestly.
        </h2>
        <div className="faq reveal" style={{ textAlign: "left" }}>
          <details className="qa" open>
            <summary>
              How is ApplyLab different from ChatGPT? <span className="chev">⌄</span>
            </summary>
            <div className="body">
              <div>
                <p>
                  ChatGPT is a blank prompt that needs endless copy-paste and often invents credentials. ApplyLab is an integrated copilot: build a verified profile once, paste a job ad to see honest gaps, generate tailored resumes and cover letters, autofill SEEK and Workday, and practise with the interview coach.
                </p>
              </div>
            </div>
          </details>

          <details className="qa">
            <summary>
              Will ApplyLab ever invent experience to match a job ad? <span className="chev">⌄</span>
            </summary>
            <div className="body">
              <div>
                <p>
                  No. Every company, title, duty, and tool comes from your verified profile. Gaps are flagged honestly rather than papered over with fabricated claims.
                </p>
              </div>
            </div>
          </details>

          <details className="qa">
            <summary>
              How does the Chrome extension autofill work? <span className="chev">⌄</span>
            </summary>
            <div className="body">
              <div>
                <p>
                  It detects application forms and fills Australian phone numbers, addresses, and work rights, then attaches your tailored PDF in one click across SEEK, Workday, PageUp, and LiveHire. It never auto-submits.
                </p>
              </div>
            </div>
          </details>

          <details className="qa">
            <summary>
              What do I get on the free tier? <span className="chev">⌄</span>
            </summary>
            <div className="body">
              <div>
                <p>
                  Two complete tailored applications, a single verified profile, unlimited Australian job matching, and 1-click extension autofill &mdash; no credit card required.
                </p>
              </div>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
