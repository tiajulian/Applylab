import type { ReviewItem } from "@/lib/review/types";

/** Realistic sample data for the review panel: 5 rewrites (2 flagged to verify) and 3 fixes.
 * Used by the panel tests and the dev preview page. */

const base = { resumeId: "sample", status: "open" } as const;

const rewrite = (n: number, blockId: string, before: string, after: string, extra: Partial<ReviewItem>): ReviewItem => ({
  ...base, id: `sample:rewrite:${n}`, kind: "change", ruleId: "provenance.reworded", severity: "info", provenance: "reworded",
  blockId, start: 0, end: after.length, before, after, reason: "Nothing new added. Same numbers and tools as your profile.", ...extra,
});

const verify = (n: number, blockId: string, before: string, after: string, claims: string[]): ReviewItem =>
  rewrite(n, blockId, before, after, {
    ruleId: "provenance.new_claim", severity: "verify", provenance: "new_claim", claims,
    start: after.indexOf(claims[0]), end: after.indexOf(claims[0]) + claims[0].length,
    reason: `Not in your profile: ${claims.join(", ")}. Is this true?`,
  });

/** The text of every block the samples point at, as it stands on the resume (a rewrite is already applied
 * to its block; its original lives on the item). */
export const SAMPLE_TEXTS: Record<string, string> = {
  summary: "Analytics engineer who recieved strong feedback from stakeholders and likes turning messy data into clear decisions.",
  "experienceBullet:0:0": "Built weekly Tableau dashboards so the sales team could see how each region was tracking against target.",
  "experienceBullet:0:1": "Wrote SQL to pull customer data from the warehouse for the marketing and finance teams.",
  "experienceBullet:0:2": "Partnered with product managers to define metrics for each feature launch, then checked them after release.",
  "experienceBullet:0:3": "Cut report time by 40% using dbt.",
  "experienceBullet:0:4": "Led a team of 6 analysts across two regions.",
  "experienceBullet:1:0": "Responsible for the monthly reporting pack that went to the executive team and the board.",
  "projectBullet:0:0": "Helped organize a volunteer data day where we cleaned open datasets for three local charities.",
};

export const SAMPLE_LABELS: Record<string, string> = {
  summary: "Summary",
  "experienceBullet:0:0": "Experience, Analytics Engineer",
  "experienceBullet:0:1": "Experience, Analytics Engineer",
  "experienceBullet:0:2": "Experience, Analytics Engineer",
  "experienceBullet:0:3": "Experience, Analytics Engineer",
  "experienceBullet:0:4": "Experience, Analytics Engineer",
  "experienceBullet:1:0": "Experience, Data Analyst",
  "projectBullet:0:0": "Projects, Community Data Day",
};

export function sampleItems(): ReviewItem[] {
  const rewrites = [
    rewrite(1, "experienceBullet:0:0", "Made weekly dashboards in Tableau for the sales team so they could see how each region was tracking against target.",
      "Built weekly Tableau dashboards so the sales team could see how each region was tracking against target.", {}),
    rewrite(2, "experienceBullet:0:1", "Wrote SQL queries to pull customer data from the warehouse for the marketing and finance teams.",
      "Wrote SQL to pull customer data from the warehouse for the marketing and finance teams.", {}),
    rewrite(3, "experienceBullet:0:2", "Worked with product managers to define the metrics for each new feature launch and checked them after release.",
      "Partnered with product managers to define metrics for each feature launch, then checked them after release.", {}),
    verify(4, "experienceBullet:0:3", "Cut report time using dbt.", "Cut report time by 40% using dbt.", ["40%"]),
    verify(5, "experienceBullet:0:4", "Managed a small team of analysts.", "Led a team of 6 analysts across two regions.", ["6", "two regions"]),
  ];
  const fixes = (
    [
      ["summary", "spelling", "recieved", "received", "Possible spelling mistake: 'recieved'"],
      ["experienceBullet:1:0", "style.passive", "Responsible for", "Owned", "Weak opener. 'Responsible for' hides what you actually did."],
      ["projectBullet:0:0", "spelling", "organize", "organise", "Australian English: 'organise'"],
    ] as const
  ).map(([blockId, ruleId, before, after, reason], i): ReviewItem => {
    const start = SAMPLE_TEXTS[blockId].indexOf(before);
    return { ...base, id: `sample:fix:${i + 1}`, kind: "fix", ruleId, severity: "warn", blockId, start, end: start + before.length, before, after, reason };
  });
  return [...rewrites, ...fixes];
}
