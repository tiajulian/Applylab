import { suggestionsFromList } from "@/lib/text/fuzzyMatch";
import { TOOL_CATALOG } from "@/lib/wins/toolCatalog";

/**
 * Common skills across industries - suggested as someone types a skill, together with the tools
 * catalog (tools are skills on a resume too). Suggestions only: any skill can still be typed.
 */
const SKILLS: readonly string[] = [
  // Transferable
  "Communication", "Customer Service", "Teamwork", "Leadership", "Problem Solving", "Time Management",
  "Attention to Detail", "Critical Thinking", "Stakeholder Management", "Stakeholder Engagement",
  "Relationship Building", "Negotiation", "Conflict Resolution", "Decision Making", "Adaptability",
  "Organisation", "Multitasking", "Public Speaking", "Presentation Skills", "Report Writing",
  "Written Communication", "Verbal Communication", "Coaching", "Mentoring", "Team Management",
  "People Management", "Training", "Cross-functional Collaboration", "Emotional Intelligence",
  "Active Listening", "Planning", "Prioritisation", "Initiative", "Resilience",
  // Business & admin
  "Project Management", "Program Management", "Change Management", "Risk Management",
  "Process Improvement", "Continuous Improvement", "Lean Six Sigma", "Agile", "Scrum", "Kanban",
  "Business Analysis", "Requirements Gathering", "Business Process Mapping", "Budgeting", "Forecasting",
  "Financial Analysis", "Financial Reporting", "Financial Modelling", "Accounts Payable",
  "Accounts Receivable", "Bookkeeping", "Payroll", "Bank Reconciliation", "BAS Preparation", "Auditing",
  "Taxation", "Compliance", "Governance", "Policy Development", "Contract Management",
  "Vendor Management", "Procurement", "Data Entry", "Scheduling", "Diary Management", "Minute Taking",
  "Records Management", "Document Control", "Office Administration", "Reception",
  // Sales, marketing & communications
  "Sales", "Business Development", "Account Management", "Lead Generation", "Cold Calling",
  "Customer Relationship Management", "Upselling", "Digital Marketing", "Content Marketing",
  "Social Media Marketing", "Search Engine Optimisation (SEO)", "Search Engine Marketing (SEM)",
  "Email Marketing", "Copywriting", "Content Writing", "Editing", "Proofreading", "Brand Management",
  "Market Research", "Public Relations", "Media Relations", "Event Management", "Campaign Management",
  "Community Management", "Visual Merchandising",
  // Data & technology
  "Data Analysis", "Data Visualisation", "Data Modelling", "Data Engineering", "Data Warehousing",
  "ETL", "Statistics", "Machine Learning", "Artificial Intelligence", "Deep Learning",
  "Natural Language Processing", "Business Intelligence", "Dashboard Design", "A/B Testing",
  "Software Development", "Web Development", "Frontend Development", "Backend Development",
  "API Development", "Cloud Computing", "DevOps", "CI/CD", "Microservices", "System Design",
  "Database Design", "Cyber Security", "Network Administration", "IT Support", "Troubleshooting",
  "Technical Writing", "Quality Assurance", "Test Automation", "UX Design", "UI Design",
  "User Research", "Wireframing", "Prototyping", "Graphic Design", "Video Editing", "Photography",
  // Healthcare, care & education
  "Patient Care", "Medication Administration", "Wound Care", "Infection Control", "Manual Handling",
  "First Aid", "CPR", "Mental Health First Aid", "Clinical Documentation", "Triage", "Aged Care",
  "Disability Support", "Person-centred Care", "Behaviour Support", "Case Management",
  "Care Planning", "Lesson Planning", "Classroom Management", "Curriculum Development",
  "Early Childhood Education", "Student Assessment", "Child Protection", "Working with Children Check",
  // Trades, operations & logistics
  "Workplace Health and Safety (WHS)", "Risk Assessment", "Safe Work Method Statements (SWMS)",
  "White Card", "Forklift Licence", "Heavy Rigid (HR) Licence", "Driver's Licence", "Reading Plans",
  "Blueprint Reading", "Welding", "Carpentry", "Electrical Wiring", "Plumbing", "Machine Operation",
  "Preventive Maintenance", "Equipment Maintenance", "Inventory Management", "Stock Control",
  "Warehouse Operations", "Order Picking", "Logistics", "Supply Chain Management", "Quality Control",
  "Fleet Management", "Traffic Control",
  // Hospitality & retail
  "Food Safety", "Food Handling", "Food Preparation", "Menu Planning", "Cooking", "Barista Skills",
  "Coffee Making", "Responsible Service of Alcohol (RSA)", "Responsible Conduct of Gambling (RCG)",
  "Point of Sale", "Table Service", "Bar Service", "Housekeeping", "Merchandising",
  "Loss Prevention", "Store Operations",
  // Languages
  "Bilingual", "Mandarin", "Cantonese", "Vietnamese", "Arabic", "Hindi", "Punjabi", "Spanish",
  "Italian", "Greek", "Korean", "Japanese", "Tagalog", "French", "German", "Auslan",
];

export const SKILL_CATALOG: readonly string[] = [...SKILLS, ...TOOL_CATALOG];

/** Skills matching what's been typed, as dropdown suggestions. `exclude` skips skills already chosen. */
export function suggestSkills(query: string, exclude: readonly string[] = []): { value: string }[] {
  return suggestionsFromList(query, SKILL_CATALOG, exclude);
}
