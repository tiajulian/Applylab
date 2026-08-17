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
      "served customers",
      "restocked shelves",
      "processed transactions",
      "handled a return or exchange",
      "trained a new team member",
    ],
  },
  {
    id: "hospitality",
    match: /\b(barista|waiter|waitress|hospitality|chef|cook|kitchen|cafe|café|restaurant|bartend)/i,
    starters: [
      "took customer orders",
      "prepared food or drinks",
      "kept the floor running during a rush",
      "handled a customer complaint",
      "closed down and reconciled the till",
    ],
  },
  {
    id: "admin",
    match: /\b(admin|office|receptionist|coordinator|assistant|clerk)\b/i,
    starters: [
      "managed a calendar or bookings",
      "processed invoices or paperwork",
      "answered phones and emails",
      "kept records up to date",
      "organised a meeting or event",
    ],
  },
  {
    id: "healthcare",
    match: /\b(nurse|nursing|carer|care worker|aged care|disability support|clinical)\b/i,
    starters: [
      "supported a client with daily tasks",
      "monitored and recorded client wellbeing",
      "liaised with family or other carers",
      "followed a care plan",
      "responded to an urgent situation",
    ],
  },
  {
    id: "trades_warehouse",
    match: /\b(warehouse|forklift|logistics|labourer|trade|construction|driver|picker|packer)\b/i,
    starters: [
      "picked and packed orders",
      "operated equipment or machinery",
      "kept a work site safe and tidy",
      "loaded or unloaded deliveries",
      "followed a safety procedure",
    ],
  },
  {
    id: "customer_service",
    match: /\b(customer service|call cent(re|er)|support agent|help desk)\b/i,
    starters: [
      "resolved a customer issue",
      "answered calls or messages",
      "logged a case or ticket",
      "followed up with a customer",
      "escalated a difficult issue",
    ],
  },
];

const DEFAULT_STARTERS = [
  "solved a problem",
  "helped a colleague or customer",
  "made a process faster or easier",
  "kept something organised or on track",
  "learned something new on the job",
];

export function roleFamilyStarters(jobTitle: string): string[] {
  const title = jobTitle.trim();
  if (!title) return DEFAULT_STARTERS;
  const family = ROLE_FAMILIES.find((f) => f.match.test(title));
  return family ? family.starters : DEFAULT_STARTERS;
}
