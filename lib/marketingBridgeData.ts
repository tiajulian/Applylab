// Hand-written Skills Bridge demo content for the marketing landing page.
// Static, front-end only: no backend call, no generation cost, always renders.
// Every mapping is a plausible, honest translation — nothing invented, nothing that
// couldn't survive an interview question ("tell me about a time...").

export interface BridgePair {
  /** What they actually did, in their own words. */
  did: string;
  /** The transferable competency that task demonstrates (shown as a pill). */
  proves: string;
  /** The job-ad requirement that competency satisfies. */
  asks: string;
  /** The task rewritten in resume language, for the transform showcase. */
  after: string;
}

export interface BridgePersona {
  id: string;
  label: string;
  role: string;
  pairs: BridgePair[];
}

export const BRIDGE_PERSONAS: BridgePersona[] = [
  {
    id: "retail",
    label: "I'm in retail",
    role: "Operations Coordinator",
    pairs: [
      {
        did: "Handled complaints on the floor, no manager needed",
        proves: "Stakeholder management",
        asks: "Manages competing stakeholder needs",
        after:
          "Resolved escalated customer concerns independently, maintaining service standards under pressure",
      },
      {
        did: "Balanced the till to the cent at close",
        proves: "Data accuracy & reconciliation",
        asks: "High attention to detail with financial data",
        after: "Maintained high-accuracy financial reconciliation across every shift close",
      },
      {
        did: "Trained new starters on the floor",
        proves: "Onboarding & coaching",
        asks: "Supports team members through change",
        after: "Onboarded and coached new team members to full productivity",
      },
      {
        did: "Ran the stocktake against a fixed deadline",
        proves: "Process & inventory coordination",
        asks: "Coordinates logistics across a busy calendar",
        after: "Coordinated inventory processes against fixed operational deadlines",
      },
    ],
  },
  {
    id: "hospitality",
    label: "I'm in hospitality",
    role: "Guest Experience Coordinator",
    pairs: [
      {
        did: "Managed the floor during a fully booked Saturday night",
        proves: "Real-time resourcing under pressure",
        asks: "Adapts staffing and workflow on the fly",
        after: "Directed real-time staffing and workflow across peak-demand service periods",
      },
      {
        did: "Smoothed over a wrong order before it reached the table",
        proves: "Service recovery",
        asks: "De-escalates issues before they escalate",
        after: "Proactively resolved service issues before guest impact",
      },
      {
        did: "Trained casuals on service standards in their first week",
        proves: "Rapid onboarding",
        asks: "Gets new hires productive fast",
        after: "Delivered rapid onboarding, bringing new staff to standard within one week",
      },
      {
        did: "Juggled table turns, bookings and walk-ins at once",
        proves: "Multi-channel scheduling",
        asks: "Balances competing demands in real time",
        after: "Managed multi-channel scheduling across bookings, walk-ins and turnover targets",
      },
    ],
  },
  {
    id: "nurse",
    label: "I'm a nurse",
    role: "Clinical Operations Coordinator",
    pairs: [
      {
        did: "Triaged patients by urgency, not order of arrival",
        proves: "Priority-based decision making",
        asks: "Makes judgment calls under time pressure",
        after: "Made priority-based clinical decisions under significant time pressure",
      },
      {
        did: "Documented every handover so nothing got missed",
        proves: "Process & compliance documentation",
        asks: "Maintains accurate records under audit",
        after: "Maintained audit-ready documentation across every shift handover",
      },
      {
        did: "Calmed a distressed family mid-crisis",
        proves: "Stakeholder de-escalation",
        asks: "Manages high-stakes stakeholder relationships",
        after: "De-escalated high-stakes stakeholder situations under acute stress",
      },
      {
        did: "Coordinated with 4 different specialists on one case",
        proves: "Cross-functional coordination",
        asks: "Aligns multiple stakeholders toward one outcome",
        after: "Coordinated cross-functional specialists toward a single patient outcome",
      },
    ],
  },
  {
    id: "junior",
    label: "I'm junior, want senior",
    role: "Senior Analyst",
    pairs: [
      {
        did: "Built the report your manager presented as their own analysis",
        proves: "Ownership beyond your title",
        asks: "Operates above current level",
        after: "Delivered senior-level analysis ahead of current title and tenure",
      },
      {
        did: "Caught the error before it reached the client",
        proves: "Risk management",
        asks: "Protects quality without being asked",
        after: "Identified and prevented client-facing errors through proactive quality review",
      },
      {
        did: "Onboarded the last two hires because no one else had time",
        proves: "Informal leadership",
        asks: "Takes on leadership without the title",
        after: "Led onboarding for new hires in the absence of formal management support",
      },
      {
        did: "Volunteered for the project nobody wanted",
        proves: "Initiative under ambiguity",
        asks: "Drives outcomes without clear direction",
        after: "Drove ambiguous, unowned initiatives to completion",
      },
    ],
  },
  {
    id: "other",
    label: "Something else",
    role: "Customer Success Coordinator",
    pairs: [
      {
        did: "Kept a side project running for 2 years solo",
        proves: "Self-directed execution",
        asks: "Delivers without oversight",
        after: "Independently sustained a long-running initiative with no oversight",
      },
      {
        did: "Talked a frustrated customer down over the phone",
        proves: "Conflict resolution",
        asks: "Handles pressure calmly",
        after: "Resolved high-tension customer conflict calmly and independently",
      },
      {
        did: "Organised the roster nobody else wanted to touch",
        proves: "Operational coordination",
        asks: "Manages logistics under constraints",
        after: "Managed complex scheduling logistics under ongoing constraints",
      },
      {
        did: "Taught yourself the tool the team needed",
        proves: "Fast self-learning",
        asks: "Picks up new systems quickly",
        after: "Self-directed rapid adoption of new tools ahead of team need",
      },
    ],
  },
];

// Shown when a visitor types their own background instead of picking a preset persona —
// proves the bridge works for anyone, not just the five examples.
export const GENERIC_PAIRS: BridgePair[] = [
  {
    did: "Kept things running when plans changed last minute",
    proves: "Adaptability under pressure",
    asks: "Adjusts quickly when priorities shift",
    after: "Adapted plans and workflow quickly in response to shifting priorities",
  },
  {
    did: "Explained something complicated so people actually got it",
    proves: "Clear communication",
    asks: "Translates complexity for different audiences",
    after: "Communicated complex information clearly across different audiences",
  },
  {
    did: "Noticed a problem before anyone asked you to look for it",
    proves: "Initiative",
    asks: "Acts without waiting to be told",
    after: "Identified and addressed issues proactively, without direction",
  },
  {
    did: "Kept track of a dozen moving parts at once",
    proves: "Organisation & multitasking",
    asks: "Manages multiple priorities simultaneously",
    after: "Managed multiple concurrent priorities without dropping detail",
  },
];
