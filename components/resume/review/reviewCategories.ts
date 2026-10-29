import type { ResumeReviewCategoryKey } from "@/types";
import { REVIEW_CATEGORY_LABELS } from "@/lib/marketing/copy";

/**
 * Display names and one-line explanations for the score categories, shared by the result rows,
 * the findings panel and the /resume-score explainer so all three use the same words. The scoring
 * API's own `label` field is not shown.
 */
export const REVIEW_CATEGORIES: Record<
  ResumeReviewCategoryKey,
  { label: string; description: string }
> = {
  content_quality: {
    label: REVIEW_CATEGORY_LABELS.content_quality,
    description: "Checks for specific contributions, scope and outcomes. Numbers are optional.",
  },
  ats_structure: {
    label: "Structure & contact details",
    description: "Checks contact details, sections and role information. This does not test the original file's layout or ATS compatibility.",
  },
  writing_quality: {
    label: REVIEW_CATEGORY_LABELS.writing_quality,
    description: "Looks for active verbs, short sentences, Australian English and no filler phrases.",
  },
  job_optimization: {
    label: "Match to this job",
    description: "Compares your resume with the attached job advertisement. Not assessed without an ad.",
  },
  application_readiness: {
    label: REVIEW_CATEGORY_LABELS.application_readiness,
    description: "Checks unfinished entries, links and repeated bullets. Optional sections do not reduce your score.",
  },
};
