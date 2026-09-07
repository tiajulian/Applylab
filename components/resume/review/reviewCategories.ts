import type { ResumeReviewCategoryKey } from "@/types";

export const REVIEW_CATEGORIES: Record<
  ResumeReviewCategoryKey,
  { label: string; description: string }
> = {
  ats_structure: {
    label: "ATS & structure",
    description: "Parseability, section formatting, and contact-field completeness",
  },
  content_quality: {
    label: "Content quality",
    description: "Bullet impact, concrete evidence, ownership, and metrics",
  },
  writing_quality: {
    label: "Writing quality",
    description: "Active verbs, conciseness, tone, and cliché elimination",
  },
  job_optimization: {
    label: "Job optimization",
    description: "Target title keywords and role requirement alignment",
  },
  application_readiness: {
    label: "Application readiness",
    description: "Page budget, referee completeness, and link hygiene",
  },
};
