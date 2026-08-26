// Hand-written Skills Bridge & Interactive Demo content for the marketing landing page.
// Static, front-end only: no backend call, no generation cost, always renders.

export interface SandboxSample {
  id: string;
  label: string;
  text: string;
  matchesRequirementId: string;
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

export const SANDBOX_SAMPLES: SandboxSample[] = [
  {
    id: "retail",
    label: "Retail Experience",
    text: "Managed customer complaints and coordinated floor staff during weekend busy periods.",
    matchesRequirementId: "stakeholder",
  },
  {
    id: "hospitality",
    label: "Hospitality Shift",
    text: "I managed busy Saturday dinner shifts, fixed order mistakes before customers noticed, and scheduled casual workers.",
    matchesRequirementId: "problemsolving",
  },
  {
    id: "admin",
    label: "Office Admin",
    text: "I organised client meetings, answered general email inquiries, and kept track of project deadlines on Excel.",
    matchesRequirementId: "communication",
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
  },
};

export const TESTIMONIALS: TestimonialItem[] = [
  {
    id: "1",
    name: "Sarah M.",
    location: "Sydney, NSW",
    fromRole: "Retail Shift Supervisor",
    toRole: "Operations Coordinator",
    before: "I knew I had transferable skills, but my resume just looked like basic retail duties. I kept getting ignored for corporate roles.",
    after: "ApplyLab mapped my floor complaints and till reconciliations to stakeholder management and financial auditing — backed by my real experience.",
    result: "Landed an Operations role on SEEK in 3 weeks and breezed through the behavioural interview.",
  },
  {
    id: "2",
    name: "David K.",
    location: "Melbourne, VIC",
    fromRole: "Hospitality Manager",
    toRole: "Customer Success Lead",
    before: "Applying on Workday and SEEK was a painful copy-paste marathon, and generic ChatGPT output sounded fake and full of US buzzwords.",
    after: "The Chrome extension autofilled my Australian details and cover letter in one click, and the Interview Coach prepared me for tough scenario questions.",
    result: "4 interview invites out of 5 applications across SEEK and LinkedIn.",
  },
  {
    id: "3",
    name: "Jessica T.",
    location: "Brisbane, QLD",
    fromRole: "Admin Assistant",
    toRole: "Project Coordinator",
    before: "I was worried ATS systems were rejecting me because I didn't have 'Project Manager' in my previous job title.",
    after: "ApplyLab matched my calendar governance and minute-taking to real project deliverable tracking, with zero invented claims.",
    result: "Secured a $22k salary increase in a state government agency.",
  },
  {
    id: "4",
    name: "Marcus L.",
    location: "Perth, WA",
    fromRole: "Secondary Educator",
    toRole: "Corporate L&D Specialist",
    before: "I felt stuck in teaching because I couldn't articulate classroom management in language corporate recruiters understood.",
    after: "ApplyLab highlighted instructional design and stakeholder engagement from my verified career profile, then simulated my panel interview.",
    result: "Successfully transitioned into corporate Learning & Development on first offer.",
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "1",
    question: "How is ApplyLab different from ChatGPT or generic AI resume tools?",
    answer: "ChatGPT is a blank text prompt that requires endless copying, pasting, and editing, and often hallucinates fake credentials or US corporate jargon. ApplyLab is an integrated Australian job-search copilot: build your verified career profile once, paste a job ad to see honest skill gaps, generate tailored resumes and cover letters, autofill applications on SEEK and Workday with our Chrome extension, and practice with our AI Interview Coach.",
  },
  {
    id: "2",
    question: "Will ApplyLab ever invent experience to make me match a job ad?",
    answer: "Never. Our core principle is strict fact traceability. Every bullet point on your resume, every claim in your cover letter, and every interview response originates from experience you have verified in your Career Profile. If a job requires a skill you don't possess (such as Power BI or SQL), ApplyLab flags it honestly as a gap rather than fabricating experience.",
  },
  {
    id: "3",
    question: "How does the Chrome Extension autofill work on Australian job boards?",
    answer: "Our Chrome extension integrates with Australian job portals including SEEK, LinkedIn Australia, Workday, PageUp, and LiveHire. It automatically fills Australian phone numbers (04xx xxx xxx), location fields, and work rights, directly attaches your tailored PDF resume, and generates tailored STAR-format answers for employer screening questions.",
  },
  {
    id: "4",
    question: "How does the AI Interview Coach work?",
    answer: "The Interview Coach pulls requirements directly from the job ad and your tailored resume. It simulates realistic interview rounds — including Phone Screen, Technical, Panel, Async Video, and Behavioural — and provides turn-by-turn STAR scorecard feedback on your voice or text answers so you can walk in prepared.",
  },
  {
    id: "5",
    question: "Is ApplyLab built specifically for Australian hiring conventions?",
    answer: "Yes. ApplyLab is engineered exclusively for Australia. It enforces 100% Australian English spelling and phrasing (e.g. organised, prioritised, behaviour), adheres to local recruitment norms (strict 1-to-2 page formatting without unnecessary profile photos), and supports local hiring platforms like SEEK and PageUp.",
  },
  {
    id: "6",
    question: "What do I get on the free tier?",
    answer: "You get 2 complete application packages completely free with no credit card required. This includes full access to the experience translation engine, job ad matching, resume and cover letter generation, the Chrome extension, and interview coaching.",
  },
];
