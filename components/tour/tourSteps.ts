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
    title: "Welcome to ApplyLab 👋",
    badge: "Quick Tour",
    description:
      "Your intelligent command centre for landing Australian roles. Let's take a quick 1-minute walkthrough to see how ApplyLab turns your real career facts into tailored resumes, AI interview practice, and tracked applications.",
    placement: "center",
    primaryButtonText: "Start Tour →",
  },
  {
    id: "profile",
    target: '[data-tour="nav-profile"]',
    title: "1. Verified Career Profile",
    badge: "Master Ledger",
    description:
      "Your career source of truth. Add your work history, verified achievements, and skills once. ApplyLab builds everything from your verified facts — never hallucinating or inventing claims you can't back.",
    placement: "bottom",
    primaryButtonText: "Next: Resumes →",
  },
  {
    id: "documents",
    target: '[data-tour="nav-documents"]',
    title: "2. Tailored Resumes & ATS Scoring",
    badge: "Resume Studio",
    description:
      "Paste any job description from SEEK, LinkedIn, or employer portals. Get instant ATS keyword match scores, fact-checked bullet tailoring, and curated ATS-safe PDF and DOCX exports.",

    placement: "bottom",
    primaryButtonText: "Next: Interviews →",
  },
  {
    id: "interview",
    target: '[data-tour="nav-interview"]',
    title: "3. AI Mock Interviews",
    badge: "Spoken Prep",
    description:
      "Rehearse role-specific interview questions out loud or via text with AI interviewer personas. Receive real-time STAR scoring, pacing analysis, and delivery feedback before your real interview.",
    placement: "bottom",
    primaryButtonText: "Next: Pipeline →",
  },
  {
    id: "applications",
    target: '[data-tour="nav-applications"]',
    title: "4. Application Pipeline",
    badge: "Job Tracker",
    description:
      "Track your active applications across stages (Applied, Interviewing, Offer), set interview reminders, and generate personalized follow-up emails in one click.",
    placement: "bottom",
    primaryButtonText: "Next: Extension →",
  },
  {
    id: "extension",
    target: '[data-tour="nav-extension"]',
    title: "5. 1-Click Chrome Importer",
    badge: "Browser Tool",
    description:
      "Extract job postings directly from SEEK and LinkedIn into ApplyLab in a single click using our Chrome extension to start tailoring in seconds.",
    placement: "bottom",
    primaryButtonText: "Next: Finish →",
  },
  {
    id: "complete",
    title: "You're All Set! 🚀",
    badge: "Ready to Roll",
    description:
      "You're ready to start your job search journey. Begin by building your Career Profile or pasting your first job ad. You can restart this tour anytime from your profile menu.",
    placement: "center",
    primaryButtonText: "Get Started",
  },
];
