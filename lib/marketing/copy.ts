/**
 * Single source of truth for product-level messaging (see the Clarity & Messaging brief). Every
 * marketing page, the footer, the blog CTA, the tour and onboarding read from here instead of
 * hardcoding their own description of ApplyLab.
 *
 * Deliberately has NO imports: scripts/verify-landing.mjs imports BANNED_TERMS from this file
 * directly under Node's type stripping, which can't resolve the "@/" alias.
 */

export const TIMINGS = {
  /** Unmeasured placeholder: no latency is logged yet. Replace with the real median. */
  resumeScoreSeconds: 30,
  /** Unmeasured placeholder, same as above. */
  tailorSeconds: 30,
  /** Unmeasured placeholder for the onboarding wizard (questions + profile). */
  onboardingMinutes: 3,
} as const;

export const BRAND = {
  name: "ApplyLab",
  oneLiner: "ApplyLab tailors your resume to each Australian job ad, using only your real experience.",
  headline: `Tailor your resume to any Australian job in ${TIMINGS.tailorSeconds} seconds.`,
  differentiator: "Nothing is made up, so every line holds up in an interview.",
  /** Where users write to us (also written out in content/legal/terms.md). */
  supportEmail: "support@applylab.io",
  footerTagline: "Tailored resumes and interview practice for Australian jobs.",
  blogSignoff: "ApplyLab tailors your resume to each Australian job ad, using only your real experience.",
  /** Used in titles/descriptions where "AI Job Copilot" used to be. */
  seoTagline: "Tailored resumes and interview practice for Australian jobs",
  /** First mention of "profile" on a page. */
  profileDefinition: "Your profile is a one-time record of your experience. Every resume ApplyLab writes comes from it.",
  /** What the Chrome extension actually does (extension/src/content: autofill, attach PDF, log to tracker). */
  extension: "Fills in job application forms on SEEK, Workday, PageUp and LiveHire, and attaches your tailored resume. It never submits for you.",
} as const;

export const HOW_IT_WORKS = [
  { title: "Add your experience once", body: "Upload your resume or type in your roles, duties and achievements. This becomes your profile." },
  { title: "Paste a job ad", body: "Copy any SEEK or LinkedIn ad. ApplyLab shows how well you fit and what's missing." },
  { title: "Get your tailored resume", body: "A 1-page resume written for that job, using only what's in your profile. Download it and apply." },
] as const;

/**
 * Home page only. The home page promises both halves: the interview, then being ready for it.
 * BRAND.headline stays the product-level line used by the blog.
 */
export const HOME = {
  /** The hero h1 in two parts: the loud half, then the quieter half (rendered one size down). */
  headlineLead: "Land the interview.",
  headlineRest: "Walk in prepared.",
  lead: "Paste a job ad from SEEK or LinkedIn. ApplyLab tailors your resume using only your real experience, then lets you practise the interview out loud and shows you exactly how to improve.",
  loopHeadline: "From job ad to job offer, step by step.",
} as const;

/** The home page's loop: one setup step, then the steps repeated for every job. */
export const APPLY_LOOP = {
  once: { title: "Add your experience", body: "Upload your resume or type in your roles. This becomes your profile, and you only do it once. Suggested tasks and guided questions help you show your impact." },
  repeat: [
    { tag: "Match", title: "Paste the job ad", body: "ApplyLab shows how well you fit, what you're missing, and which of your experiences to lead with." },
    { tag: "Apply", title: "Get a tailored resume and cover letter", body: "Written from your real experience in Australian English. The Chrome extension fills in SEEK, Workday and PageUp forms for you." },
    { tag: "Practise", title: "Rehearse the interview out loud", body: "Answer real questions for that exact role and get instant feedback on what to say better." },
    { tag: "Track", title: "Track every application", body: "See every job you've applied for and where each one is up to. The Chrome extension can save jobs to your tracker for you." },
  ],
} as const;

export const CTA = {
  /** Home page secondary action (hero, final CTA): jumps to the free resume score, the smallest ask. */
  scoreFree: "Score my resume free",
  primary: "Score your resume free",
  startFree: "Start free",
  goPro: "Go Pro",
  howItWorks: "See how it works",
} as const;

/** Markdown sign-off appended to blog posts in place of the old per-post "ApplyLab is..." lines. */
export const BLOG_SIGNOFF_MARKDOWN = `*${BRAND.blogSignoff} [See how it works →](https://applylab.io/#how)*`;

/**
 * Plain-language display names for the resume score categories. The scoring API keeps its own
 * labels; the UI shows these so the explanation on /resume-score and the result rows match.
 */
export const REVIEW_CATEGORY_LABELS = {
  content_quality: "Strength of your achievements",
  ats_structure: "Readable by hiring software",
  writing_quality: "Clear writing",
  job_optimization: "Fit for your target role",
  application_readiness: "Ready to send",
} as const;

/** User-facing names for the free-tier-limited AI features (dashboard meters + limit messages). */
export const FEATURE_LABELS = {
  "cover-letter": { singular: "cover letter", plural: "Cover letters" },
  "followup-draft": { singular: "follow-up email", plural: "Follow-up emails" },
  "extract-skills": { singular: "skill finder", plural: "Skills found in job ads" },
  "resume-review": { singular: "resume score", plural: "Resume scores" },
  "win-polish": { singular: "achievement improvement", plural: "Achievements improved" },
  "win-starters": { singular: "achievement idea", plural: "Achievement ideas" },
  "role-duties-suggest": { singular: "suggested duties", plural: "Suggested duties" },
  "role-duties-bulletify": { singular: "duties-to-achievements", plural: "Duties turned into achievements" },
  "project-enhance": { singular: "project improvement", plural: "Projects improved" },
  "skills-bridge": { singular: "skill gap fix", plural: "Skill gap fixes" },
  copilot: { singular: "AI assistant answer", plural: "AI assistant answers" },
} as const;

/**
 * Terms that must not appear in user-facing marketing text (brief section 3). Matched
 * case-insensitively against rendered page text by scripts/verify-landing.mjs.
 */
export const BANNED_TERMS = [
  "verified profile",
  "master profile",
  "career profile",
  "verified career history",
  "evidence chain",
  "grounded",
  "traceable",
  "tethered",
  "hallucinat",
  "AU job matching",
  "maps evidence",
  "skills bridge",
  "win starter",
  "win polish",
  "bulletify",
  "project enhance",
  "co-pilot",
  "copilot",
  "skill extraction",
  "discrepancy",
  "Full Access",
  "Kanban",
  "parseability",
  "lead magnet",
  "diagnostic",
  "pillars",
  // Landing copy brief (interview practice): defensive or hype words.
  "defend",
  "defensible",
  "ledger",
  "unlimited power",
  "seamless",
  "revolutionis",
] as const;
