// Hand-written Skills Bridge demo content for the marketing landing page.
// Static, front-end only: no backend call, no generation cost, always renders.
// Every mapping is a plausible, honest translation — nothing invented, nothing that
// couldn't survive an interview question ("tell me about a time...").

export interface BridgeStep {
  /** What they actually did, in their own words. */
  task: string;
  /** The transferable competency that task demonstrates. */
  competency: string;
  /** The job-ad requirement that competency satisfies. */
  requirement: string;
}

export interface BridgeTransform {
  before: string;
  after: string;
}

export interface BridgePersona {
  id: string;
  pillLabel: string;
  targetRole: string;
  steps: BridgeStep[];
  transform: BridgeTransform;
}

export const BRIDGE_PERSONAS: BridgePersona[] = [
  {
    id: "retail",
    pillLabel: "I'm in retail",
    targetRole: "Operations Coordinator",
    steps: [
      {
        task: "Handled complaints on the floor, no manager needed",
        competency: "Stakeholder management",
        requirement: "Manages competing stakeholder needs",
      },
      {
        task: "Balanced the till to the cent at close",
        competency: "Data accuracy & reconciliation",
        requirement: "High attention to detail with financial data",
      },
      {
        task: "Trained new starters on the floor",
        competency: "Onboarding & coaching",
        requirement: "Supports team members through change",
      },
      {
        task: "Ran the stocktake against a fixed deadline",
        competency: "Process & inventory coordination",
        requirement: "Coordinates logistics across a busy calendar",
      },
    ],
    transform: {
      before: "Dealt with angry customers",
      after:
        "Resolved escalated customer concerns independently, maintaining service standards under pressure",
    },
  },
  {
    id: "hospitality",
    pillLabel: "I'm in hospitality",
    targetRole: "Client Services Coordinator",
    steps: [
      {
        task: "Rebuilt the roster around last-minute no-shows",
        competency: "Resource coordination",
        requirement: "Plans and reallocates resources under time pressure",
      },
      {
        task: "Ran the pass solo through a full house",
        competency: "Performing under pressure",
        requirement: "Delivers to deadline in high-pressure environments",
      },
      {
        task: "Talked a table down without pulling in a manager",
        competency: "Conflict resolution",
        requirement: "De-escalates and resolves issues independently",
      },
      {
        task: "Pushed specials to hit nightly targets",
        competency: "Target delivery",
        requirement: "Contributes to sales and performance targets",
      },
    ],
    transform: {
      before: "Worked the floor on busy nights",
      after:
        "Coordinated live service for 80+ covers a night, prioritising under pressure with zero manager escalations",
    },
  },
  {
    id: "nurse",
    pillLabel: "I'm a nurse",
    targetRole: "Case Coordinator",
    steps: [
      {
        task: "Triaged patients by clinical urgency",
        competency: "Prioritisation under pressure",
        requirement: "Assesses and prioritises competing demands",
      },
      {
        task: "Wrote care plans for shift handover",
        competency: "Reporting & documentation",
        requirement: "Maintains accurate records for compliance",
      },
      {
        task: "Liaised between families, doctors and allied health",
        competency: "Cross-functional communication",
        requirement: "Coordinates across multiple stakeholders",
      },
      {
        task: "Mentored grad nurses on shift",
        competency: "People development",
        requirement: "Supports and develops junior staff",
      },
    ],
    transform: {
      before: "Looked after patients on the ward",
      after:
        "Coordinated care for a 12-patient caseload, prioritising against shifting clinical urgency and reporting to a multidisciplinary team",
    },
  },
  {
    id: "junior",
    pillLabel: "I'm junior, want senior",
    targetRole: "Senior Coordinator",
    steps: [
      {
        task: "Picked up the onboarding doc no one owned",
        competency: "Ownership beyond scope",
        requirement: "Takes initiative beyond the immediate brief",
      },
      {
        task: "Flagged a recurring process error to management",
        competency: "Process improvement",
        requirement: "Identifies and improves inefficient processes",
      },
      {
        task: "Trained the two newest hires last quarter",
        competency: "Informal leadership",
        requirement: "Mentors and upskills junior team members",
      },
      {
        task: "Ran point on a project while my manager was on leave",
        competency: "Autonomous accountability",
        requirement: "Operates independently with senior-level accountability",
      },
    ],
    transform: {
      before: "Helped train new team members",
      after:
        "Informally led onboarding for two new hires, becoming the team's go-to reference in my manager's absence",
    },
  },
  {
    id: "other",
    pillLabel: "Something else",
    targetRole: "Coordinator / Advisor",
    steps: [
      {
        task: "Answered 50+ calls a day, solving issues on the spot",
        competency: "High-volume problem solving",
        requirement: "Resolves issues efficiently at volume",
      },
      {
        task: "Kept a shared calendar and inbox running for the team",
        competency: "Administrative coordination",
        requirement: "Coordinates schedules and communications",
      },
      {
        task: "Wrote the how-to doc nobody else got around to",
        competency: "Process documentation",
        requirement: "Creates and maintains clear documentation",
      },
    ],
    transform: {
      before: "Answered customer questions all day",
      after: "Resolved 50+ customer enquiries daily, maintaining first-contact resolution under volume",
    },
  },
];
