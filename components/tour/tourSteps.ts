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
    description: `${BRAND.oneLiner} This 1-minute tour shows where everything is.`,
    placement: "center",
    primaryButtonText: "Start tour →",
  },
  {
    id: "profile",
    target: '[data-tour="nav-profile"]',
    title: "1. Your profile",
    badge: "Start here",
    description:
      "Add your roles, achievements and skills once. Every resume and cover letter is written from this, so nothing is made up.",
    placement: "bottom",
    primaryButtonText: "Next: Resumes →",
  },
  {
    id: "documents",
    target: '[data-tour="nav-documents"]',
    title: "2. Resumes and cover letters",
    badge: "Main tool",
    description:
      "Paste a job ad from SEEK or LinkedIn. You'll see how well you fit, then get a 1-page resume written for that job. Download as PDF or Word.",
    placement: "bottom",
    primaryButtonText: "Next: Interviews →",
  },
  {
    id: "interview",
    target: '[data-tour="nav-interview"]',
    title: "3. Interview practice",
    badge: "Practise",
    description:
      "Practise answering questions for the job, out loud or by typing, and get feedback on each answer.",
    placement: "bottom",
    primaryButtonText: "Next: Tracker →",
  },
  {
    id: "applications",
    target: '[data-tour="nav-applications"]',
    title: "4. Application tracker",
    badge: "Stay organised",
    description:
      "Track every job you've applied for, set interview reminders and draft follow-up emails.",
    placement: "bottom",
    primaryButtonText: "Next: Extension →",
  },
  {
    id: "extension",
    target: '[data-tour="nav-extension"]',
    title: "5. Chrome extension",
    badge: "Optional",
    description: BRAND.extension,
    placement: "bottom",
    primaryButtonText: "Next: Finish →",
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
