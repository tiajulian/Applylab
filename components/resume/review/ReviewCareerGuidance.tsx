"use client";

import { useState } from "react";

const GUIDANCE = {
  starting: "Use real projects, placements, coursework or volunteering to show what you can do. Commercial results and paid experience are not required for every example.",
  changing: "Explain how your real tasks connect to the work you want. Keep your previous job titles accurate, and distinguish total career experience from experience in your new field.",
  continuing: "Make your relevant contributions and responsibilities easy to find. Outcomes can be qualitative; include numbers only when you can support them.",
  returning: "Focus on relevant experience and skills. Explaining a career break is optional; you do not need to share personal circumstances.",
} as const;

export function ReviewCareerGuidance() {
  const [stage, setStage] = useState("");
  return (
    <details className="rounded-xl border border-border bg-surface px-4 py-3">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-ink focus-visible:outline-accent">Advice for your career situation (optional)</summary>
      <label htmlFor="review-career-stage" className="mt-2 block text-sm text-ink-secondary">What best describes your situation?</label>
      <select id="review-career-stage" value={stage} onChange={(event) => setStage(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-ink focus:outline-accent">
        <option value="">Choose, or leave this blank</option>
        <option value="starting">Starting my career</option>
        <option value="changing">Changing careers</option>
        <option value="continuing">Continuing in my field</option>
        <option value="returning">Returning to work</option>
      </select>
      {stage && <p role="status" className="mt-3 text-sm leading-relaxed text-ink-secondary">{GUIDANCE[stage as keyof typeof GUIDANCE]}</p>}
      <p className="mt-3 text-xs text-ink-muted">This optional guidance does not change your score or profile.</p>
    </details>
  );
}
