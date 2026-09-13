"use client";

export function StatsBand() {
  return (
    <section className="section tint">
      <div className="container">
        <div className="stats stagger" data-countup="true">
          <div className="stat">
            <div className="num">
              <span data-to="3400">0</span>
              <span className="suffix">+</span>
            </div>
            <div className="lbl">Australian job seekers</div>
          </div>
          <div className="stat">
            <div className="num">
              <span data-to="4.8" data-dec="1">
                0
              </span>
            </div>
            <div className="lbl">Chrome extension rating</div>
          </div>
          <div className="stat">
            <div className="num">
              <span data-to="1.4" data-dec="1">
                0
              </span>
              <span className="suffix">s</span>
            </div>
            <div className="lbl">Average autofill time</div>
          </div>
          <div className="stat">
            <div className="num">
              <span data-to="100">0</span>
              <span className="suffix">%</span>
            </div>
            <div className="lbl">Claims traced to evidence</div>
          </div>
        </div>
      </div>
    </section>
  );
}
