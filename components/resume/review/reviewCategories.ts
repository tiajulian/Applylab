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
    description: "Checks your bullets show results, with numbers and clear ownership, not just tasks.",
  },
  ats_structure: {
    label: REVIEW_CATEGORY_LABELS.ats_structure,
    description: "Checks hiring software (ATS) can read your contact details, headings and layout.",
  },
  writing_quality: {
    label: REVIEW_CATEGORY_LABELS.writing_quality,
    description: "Looks for active verbs, short sentences, Australian English and no filler phrases.",
  },
  job_optimization: {
    label: REVIEW_CATEGORY_LABELS.job_optimization,
    description: "Checks you use the words and skills that roles like yours ask for.",
  },
  application_readiness: {
    label: REVIEW_CATEGORY_LABELS.application_readiness,
    description: "Checks length, referees, links and that bullets aren't repeated across roles.",
  },
};
