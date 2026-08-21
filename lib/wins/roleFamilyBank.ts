interface RoleFamily {
  id: string;
  match: RegExp;
  starters: string[];
}

/**
 * Title rung of the Win Builder's personalisation ladder (Part F) - the last-resort, always-
 * available fallback when there's no usable role description and no confirmed duties yet for
 * this job title. Zero API: a fixed, plain-language question bank keyed by loose keyword match on
 * the job title. Every entry is still just a tap-to-use starting point for the "what" field, never
 * pre-filled or auto-added.
 */
const ROLE_FAMILIES: RoleFamily[] = [
  {
    id: "retail",
    match: /\b(retail|sales assistant|store|cashier|merchandis)/i,
    starters: [
      "Assisted customers with product inquiries and resolved service requests promptly",
      "Restocked inventory and maintained visual merchandising standards across sales floor",
      "Processed POS transactions accurately and reconciled daily register takings",
      "Handled customer returns, exchanges, and warranty queries in compliance with store policies",
      "Trained and mentored new team members on store operations and customer service guidelines",
    ],
  },
  {
    id: "hospitality",
    match: /\b(barista|waiter|waitress|hospitality|chef|cook|kitchen|cafe|café|restaurant|bartend)/i,
    starters: [
      "Welcomed patrons, took accurate orders, and provided high-quality food and beverage service",
      "Prepared menu items efficiently in accordance with health and food safety standards",
      "Maintained smooth dining room operations and service flow during peak rush periods",
      "Resolved customer complaints diplomatically to ensure a positive dining experience",
      "Completed end-of-shift register reconciliations and kitchen sanitation procedures",
    ],
  },
  {
    id: "admin",
    match: /\b(admin|office|receptionist|coordinator|assistant|clerk)\b/i,
    starters: [
      "Managed executive calendars, meeting schedules, and room reservations across teams",
      "Processed vendor invoices, purchase orders, and administrative documentation accurately",
      "Managed incoming communications, phone inquiries, and correspondence professionally",
      "Maintained centralized electronic databases and physical record filing systems",
      "Coordinated logistical arrangements for internal meetings, workshops, and corporate events",
    ],
  },
  {
    id: "healthcare",
    match: /\b(nurse|nursing|carer|care worker|aged care|disability support|clinical)\b/i,
    starters: [
      "Supported clients with daily living activities, personal care, and mobility requirements",
      "Monitored and documented client health status, vital signs, and progress notes",
      "Liaised with multidisciplinary health teams and family members to coordinate care plans",
      "Administered medication and executed personalized support plans adhering to health regulations",
      "Responded calmly and effectively to medical emergencies and urgent care incidents",
    ],
  },
  {
    id: "trades_warehouse",
    match: /\b(warehouse|forklift|logistics|labourer|trade|construction|driver|picker|packer)\b/i,
    starters: [
      "Picked, packed, and dispatched customer orders against daily fulfillment targets",
      "Operated warehouse equipment and machinery safely in compliance with WHS standards",
      "Maintained clean, hazard-free work environments and conducted safety inspections",
      "Loaded and unloaded freight shipments while inspecting incoming goods for damage",
      "Executed inventory counts and reconciled stock movements within warehouse systems",
    ],
  },
  {
    id: "customer_service",
    match: /\b(customer service|call cent(re|er)|support agent|help desk)\b/i,
    starters: [
      "Resolved customer inquiries via phone, email, and live chat to maintain satisfaction",
      "Logged, tracked, and updated support tickets within CRM software",
      "Identified root causes of complex customer issues and coordinated timely escalations",
      "Guided users through troubleshooting procedures to resolve technical difficulties",
      "Followed up with clients to ensure complete resolution of service requests",
    ],
  },
];

const DEFAULT_STARTERS = [
  "Identified operational bottlenecks and implemented streamlined workflow improvements",
  "Collaborated with cross-functional team members to deliver key project milestones on schedule",
  "Analyzed key data to support evidence-based business decision-making",
  "Maintained accurate documentation and compliance records in line with organizational standards",
  "Communicated effectively with internal and external stakeholders to resolve operational issues",
];

export function roleFamilyStarters(jobTitle: string): string[] {
  const title = jobTitle.trim();
  if (!title) return DEFAULT_STARTERS;
  const family = ROLE_FAMILIES.find((f) => f.match.test(title));
  return family ? family.starters : DEFAULT_STARTERS;
}
