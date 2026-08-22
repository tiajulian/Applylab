// Hand-written Skills Bridge & Interactive Demo content for the marketing landing page.
// Static, front-end only: no backend call, no generation cost, always renders.

export interface HeroPreset {
  id: string;
  fromRole: string;
  toRole: string;
  label: string;
  whatYouDid: string;
  understands: string[];
  resumeReady: string;
}

export interface CareerTransition {
  id: string;
  fromRole: string;
  toRole: string;
  label: string;
  sourceExperience: string;
  identifiedSkills: string[];
  targetRequirements: string[];
  resumeBullet: string;
}

export interface JobAdRequirement {
  id: string;
  title: string;
  sourceText: string;
  whyMatches: string;
  resumeWording: string;
}

export interface TestimonialItem {
  id: string;
  name: string;
  location: string;
  fromRole: string;
  toRole: string;
  before: string;
  after: string;
  result: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface BridgePair {
  did: string;
  proves: string;
  asks: string;
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
        after: "Resolved escalated customer concerns independently, maintaining service standards under pressure",
      },
    ],
  },
];

export const GENERIC_PAIRS: BridgePair[] = [
  {
    did: "Kept things running when plans changed last minute",
    proves: "Adaptability under pressure",
    asks: "Adjusts quickly when priorities shift",
    after: "Adapted plans and workflow quickly in response to shifting priorities",
  },
];

export const HERO_PRESETS: HeroPreset[] = [
  {
    id: "retail-ops",
    fromRole: "Retail",
    toRole: "Operations",
    label: "Retail → Operations",
    whatYouDid: "Handled customer complaints and solved problems without needing my manager.",
    understands: ["Customer service", "Conflict resolution", "Independent decision-making", "Stakeholder management"],
    resumeReady: "Resolved escalated customer concerns independently, maintaining service standards under pressure.",
  },
  {
    id: "hosp-events",
    fromRole: "Hospitality",
    toRole: "Events",
    label: "Hospitality → Events",
    whatYouDid: "Managed peak dinner rush, coordinated floor staff, and kept table turns on schedule.",
    understands: ["Event coordination", "Real-time resourcing", "Vendor communication", "Priority scheduling"],
    resumeReady: "Directed floor operations and staff workflow during high-volume service windows to achieve turn targets.",
  },
  {
    id: "admin-project",
    fromRole: "Admin",
    toRole: "Project Coordination",
    label: "Admin → Project Coordination",
    whatYouDid: "Organised weekly team meetings, updated project spreadsheets, and tracked deliverable dates.",
    understands: ["Schedule management", "Deliverable tracking", "Cross-team communication", "Process documentation"],
    resumeReady: "Coordinated cross-functional meeting agendas and tracked project milestones against tight operational deadlines.",
  },
  {
    id: "service-banking",
    fromRole: "Customer Service",
    toRole: "Banking",
    label: "Customer Service → Banking",
    whatYouDid: "Processed daily cash registers, checked ID compliance, and answered client account queries.",
    understands: ["Financial reconciliation", "Regulatory compliance", "Client onboarding", "Data accuracy"],
    resumeReady: "Executed high-accuracy financial reconciliation and verified customer compliance with strict audit standards.",
  },
  {
    id: "teaching-training",
    fromRole: "Teaching",
    toRole: "Training",
    label: "Teaching → Training",
    whatYouDid: "Created learning modules, adapted materials for different students, and assessed progress.",
    understands: ["Instructional design", "Stakeholder engagement", "Performance evaluation", "Change management"],
    resumeReady: "Designed and facilitated structured training programs tailored to diverse adult learning profiles.",
  },
  {
    id: "warehouse-logistics",
    fromRole: "Warehouse",
    toRole: "Logistics",
    label: "Warehouse → Logistics",
    whatYouDid: "Managed inbound stock shipments, checked manifests, and resolved dispatch delays.",
    understands: ["Supply chain coordination", "Inventory control", "Manifest verification", "Vendor liaison"],
    resumeReady: "Managed end-to-end inventory dispatch and audited freight manifests to eliminate delivery bottlenecks.",
  },
];

export const CAREER_TRANSITIONS: CareerTransition[] = [
  {
    id: "retail-ops",
    fromRole: "Retail Shift Supervisor",
    toRole: "Operations Coordinator",
    label: "Retail → Operations",
    sourceExperience: "Managed customer complaints and coordinated floor staff during weekend busy periods.",
    identifiedSkills: ["Stakeholder management", "Team coordination", "Operational decision-making", "Conflict resolution"],
    targetRequirements: ["Incident management", "Process coordination", "Stakeholder communication", "Operational support"],
    resumeBullet: "Coordinated operational workflows and resolved escalated customer issues independently, maintaining service standards under peak volume.",
  },
  {
    id: "hosp-events",
    fromRole: "Restaurant Team Leader",
    toRole: "Event Logistics Coordinator",
    label: "Hospitality → Events",
    sourceExperience: "Juggled private dining bookings, supplier deliveries, and staff rosters on short notice.",
    identifiedSkills: ["Multi-channel scheduling", "Vendor liaison", "Resource allocation", "Problem solving under pressure"],
    targetRequirements: ["Event scheduling", "Supplier management", "Resource planning", "Live event execution"],
    resumeBullet: "Managed vendor deliveries and real-time staffing schedules for complex high-profile events with strict delivery timelines.",
  },
  {
    id: "admin-project",
    fromRole: "Executive Assistant",
    toRole: "Junior Project Manager",
    label: "Admin → Project Coordination",
    sourceExperience: "Maintained executive calendars, tracked action items from board meetings, and formatted monthly reports.",
    identifiedSkills: ["Milestone tracking", "Governance documentation", "Executive communication", "Task prioritization"],
    targetRequirements: ["Project tracking", "Stakeholder reporting", "Risk escalation", "Meeting facilitation"],
    resumeBullet: "Tracked cross-functional project deliverables and facilitated executive progress reporting to keep key milestones on schedule.",
  },
  {
    id: "service-banking",
    fromRole: "Call Centre Specialist",
    toRole: "Banking Operations Associate",
    label: "Customer Service → Banking",
    sourceExperience: "Assisted customers with account security checks, billing disputes, and system navigation.",
    identifiedSkills: ["KYC/AML verification", "Dispute resolution", "Data compliance", "System troubleshooting"],
    targetRequirements: ["Compliance auditing", "Customer verification", "Account reconciliation", "Process accuracy"],
    resumeBullet: "Performed identity verification and resolved complex account disputes in accordance with financial regulatory compliance guidelines.",
  },
  {
    id: "tech-data",
    fromRole: "IT Support Technician",
    toRole: "Data & Systems Analyst",
    label: "Tech Support → Data",
    sourceExperience: "Resolved user ticket queues, checked system error logs, and wrote basic SQL queries for weekly reports.",
    identifiedSkills: ["Root-cause analysis", "Ticket queue management", "SQL reporting", "System troubleshooting"],
    targetRequirements: ["Data validation", "Reporting automation", "Incident triage", "Technical documentation"],
    resumeBullet: "Analyzed system performance logs and built automated SQL queries to streamline internal operational reporting.",
  },
  {
    id: "warehouse-logistics",
    fromRole: "Forklift Operator / Storeperson",
    toRole: "Logistics Specialist",
    label: "Warehouse → Logistics",
    sourceExperience: "Received freight consignments, checked purchase orders against stock received, and arranged courier pickups.",
    identifiedSkills: ["Inventory audit", "Freight documentation", "Dispatch optimization", "Quality assurance"],
    targetRequirements: ["Supply chain tracking", "Consignment verification", "Freight coordination", "Compliance safety"],
    resumeBullet: "Audited inbound freight consignments against purchase orders to ensure 100% stock accuracy across supply chain operations.",
  },
];

export const MOCK_JOB_AD = {
  title: "Operations Coordinator",
  company: "Metro Logistics & Services",
  location: "Sydney NSW · Hybrid",
  requirements: [
    {
      id: "stakeholder",
      title: "Stakeholder management",
      sourceText: "Handled customer complaints and staff scheduling on the floor.",
      whyMatches: "You described resolving customer issues independently and coordinating team members. That's direct evidence of stakeholder communication and issue resolution.",
      resumeWording: "Managed escalated customer concerns and internal stakeholder communications to resolve operational challenges efficiently.",
    },
    {
      id: "process",
      title: "Process improvement",
      sourceText: "Reorganized the stockroom shelf system to find inventory faster.",
      whyMatches: "Improving stockroom layout directly proves initiative in workflow optimization and reducing retrieval cycle time.",
      resumeWording: "Redesigned inventory storage protocols, improving stock retrieval speeds and operational workflow efficiency.",
    },
    {
      id: "reporting",
      title: "Reporting & reconciliation",
      sourceText: "Balanced daily tills and wrote shift handover notes.",
      whyMatches: "Balancing tills to the cent demonstrates high financial accuracy, reporting discipline, and data integrity under audit.",
      resumeWording: "Prepared accurate daily financial reconciliations and shift operational reports with high attention to detail.",
    },
    {
      id: "communication",
      title: "Customer communication",
      sourceText: "Answered phone inquiries and resolved client concerns.",
      whyMatches: "Frontline customer communication transfers directly to client relationship management and operational support.",
      resumeWording: "Communicated with internal and external clients to resolve service inquiries and maintain high satisfaction levels.",
    },
    {
      id: "problemsolving",
      title: "Problem solving under pressure",
      sourceText: "Handled unexpected staff call-outs during busy weekend rushes.",
      whyMatches: "Adapting staffing on short notice proves real-time problem solving and resource reallocation.",
      resumeWording: "Adapted operational priorities dynamically during peak periods to maintain service continuity under resource constraints.",
    },
  ],
  missingSkill: {
    title: "Power BI",
    note: "ApplyLab won't invent Power BI experience just to increase your score.",
  },
};

export const TESTIMONIALS: TestimonialItem[] = [
  {
    id: "1",
    name: "Sarah M.",
    location: "Sydney, NSW",
    fromRole: "Retail Supervisor",
    toRole: "Operations Coordinator",
    before: "I knew I had transferable experience, but my resume looked like a list of basic retail duties. I kept getting rejected for office roles.",
    after: "ApplyLab helped me see that managing customer complaints and balancing tills actually mapped to stakeholder management and financial reconciliation.",
    result: "Landed an Operations Coordinator role on SEEK within 3 weeks.",
  },
  {
    id: "2",
    name: "David K.",
    location: "Melbourne, VIC",
    fromRole: "Hospitality Shift Manager",
    toRole: "Events Assistant",
    before: "ChatGPT kept writing fake buzzwords like 'synergized cross-functional paradigms' that sounded completely fake and didn't sound like me.",
    after: "ApplyLab translated my real floor management experience into clean, professional language based only on what I actually did.",
    result: "Invited to 4 interviews out of 5 applications.",
  },
  {
    id: "3",
    name: "Jessica T.",
    location: "Brisbane, QLD",
    fromRole: "Admin Assistant",
    toRole: "Project Coordinator",
    before: "I was worried ATS systems were throwing out my application because I didn't have 'Project Manager' in my previous job title.",
    after: "ApplyLab matched my calendar management and meeting minutes to project deliverable tracking and governance requirements.",
    result: "Secured a 25% salary bump in a Project Coordinator role.",
  },
  {
    id: "4",
    name: "Marcus L.",
    location: "Perth, WA",
    fromRole: "Primary School Educator",
    toRole: "Corporate L&D Specialist",
    before: "I felt completely stuck in education because I didn't know how to frame classroom management for corporate hiring managers.",
    after: "ApplyLab highlighted instructional design, stakeholder engagement, and adult training frameworks from my teaching background.",
    result: "Transitioned successfully into corporate Learning & Development.",
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "1",
    question: "How is ApplyLab different from ChatGPT or generic AI tools?",
    answer: "ChatGPT requires you to write complex prompts, copy-paste back and forth, check for invented facts, and manually format the document. ApplyLab is a purpose-built workflow: enter your experience once, paste the Australian job ad, see exact evidence-backed skill matches, and generate a tailored 1-page resume instantly without hallucinations.",
  },
  {
    id: "2",
    question: "Will ApplyLab invent experience to make my resume match the job ad?",
    answer: "Never. ApplyLab works strictly from the evidence you provide. If a job ad asks for a tool or qualification you haven't listed (like Power BI or SQL), ApplyLab will clearly flag it as a missing skill rather than fabricating fake experience. Your resume will always be 100% truthful and interview-ready.",
  },
  {
    id: "3",
    question: "Is ApplyLab specifically tailored for the Australian job market?",
    answer: "Yes. ApplyLab uses Australian English (spelling, phrasing, and grammar), aligns with Australian application conventions (strict 1-page layout, clean hierarchy, no photo requirement), and is optimised for jobs posted on SEEK, LinkedIn Australia, and corporate Workday portals.",
  },
  {
    id: "4",
    question: "Can ApplyLab guarantee my resume will pass ATS filtering?",
    answer: "No legitimate tool can guarantee an ATS 'pass' because ATS systems are candidate databases, not pass/fail test filters. ApplyLab ensures your resume is cleanly formatted so recruiters and parsing software can easily read, extract, and match your experience to job criteria.",
  },
  {
    id: "5",
    question: "How does the free tier work?",
    answer: "You get 2 full resume builds completely free with no credit card required. You can test the experience translation, job matching, and PDF generation before deciding to upgrade.",
  },
  {
    id: "6",
    question: "Can ApplyLab help me transition into a different industry?",
    answer: "Absolutes yes — that is ApplyLab's core superpower. ApplyLab analyzes your past duties (e.g. retail, hospitality, admin, teaching) and identifies transferable skills like stakeholder management, process coordination, and risk mitigation that apply directly to target roles.",
  },
];
