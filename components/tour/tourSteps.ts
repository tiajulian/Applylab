import { BRAND, TIMINGS } from "@/lib/marketing/copy";

export interface TourStep {
  id: string;
  target?: string; // CSS selector or data-tour identifier. If undefined, rendered as center modal
  title: string;
  badge?: string;
  description: string;
  placement?: "bottom" | "top" | "left" | "right" | "center";
  primaryButtonText?: string;
  actionHref?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to ApplyLab",
    badge: "Quick tour",
    description: `${BRAND.oneLiner} This 1-minute tour shows the 4 steps.`,
    placement: "center",
    primaryButtonText: "Start tour →",
  },
  {
    id: "profile",
    target: '[data-tour="nav-profile"]',
    title: "Step 1: Profile",
    badge: "Start here",
    description:
      "Add your jobs, achievements and skills once. Every resume and cover letter is written from this, so nothing is made up.",
    placement: "right",
    primaryButtonText: "Next →",
  },
  {
    id: "documents",
    target: '[data-tour="nav-documents"]',
    title: "Step 2: Resumes",
    badge: "Main tool",
    description:
      "Paste a job ad from SEEK or LinkedIn. You'll see how well you fit, then get a 1-page resume written for that job.",
    placement: "right",
    primaryButtonText: "Next →",
  },
  {
    id: "applications",
    target: '[data-tour="nav-applications"]',
    title: "Step 3: Applications",
    badge: "Stay organised",
    description: "Keep a list of every job you've applied for, with interview dates and follow-up emails.",
    placement: "right",
    primaryButtonText: "Next →",
  },
  {
    id: "interview",
    target: '[data-tour="nav-interview"]',
    title: "Step 4: Interview practice",
    badge: "Practise",
    description: "Practise answering questions for the job, out loud or by typing, and get feedback on each answer.",
    placement: "right",
    primaryButtonText: "Next →",
  },
  {
    id: "extension",
    target: '[data-tour="nav-extension"]',
    title: "Extra: Chrome extension",
    badge: "Optional",
    description: BRAND.extension,
    placement: "right",
    primaryButtonText: "Next →",
  },
  {
    id: "complete",
    title: "You're all set",
    badge: "Next step",
    description: `Start by adding your experience to your profile. It takes about ${TIMINGS.onboardingMinutes} minutes.`,
    placement: "center",
    primaryButtonText: "Get started",
  },
];
