import { suggestFromList } from "@/lib/text/fuzzyMatch";

/**
 * Common Australian job titles across industries, suggested as someone types a job title so they
 * don't have to spell it out (or misspell it). Suggestions only: any title can still be typed.
 * Roughly most-common first within each group - ties in matching fall back to this order.
 */
export const JOB_TITLE_CATALOG: readonly string[] = [
  // Business, admin & office
  "Administration Officer", "Administrative Assistant", "Office Manager", "Receptionist",
  "Executive Assistant", "Personal Assistant", "Office Administrator", "Data Entry Operator",
  "Customer Service Representative", "Customer Service Officer", "Call Centre Operator",
  "Business Analyst", "Project Manager", "Project Coordinator", "Program Manager", "Operations Manager",
  "Operations Coordinator", "Business Development Manager", "General Manager", "Chief Executive Officer",
  "Chief Operating Officer", "Chief Financial Officer", "Chief Technology Officer", "Management Consultant",
  "Policy Officer", "Policy Advisor", "Project Officer", "Contract Administrator", "Procurement Officer",
  "Procurement Manager", "Change Manager", "Risk Analyst", "Compliance Officer", "Compliance Manager",
  "Governance Officer", "Records Officer", "Team Leader", "Team Assistant",
  // Data & analytics
  "Data Analyst", "Senior Data Analyst", "Data Scientist", "Data Engineer", "Analytics Engineer",
  "Business Intelligence Analyst", "BI Developer", "Reporting Analyst", "Insights Analyst",
  "Machine Learning Engineer", "AI Engineer", "Statistician", "Data Architect", "Database Administrator",
  "Data Governance Analyst", "Quantitative Analyst",
  // Technology
  "Software Engineer", "Senior Software Engineer", "Software Developer", "Full Stack Developer",
  "Frontend Developer", "Backend Developer", "Web Developer", "Mobile Developer", "iOS Developer",
  "Android Developer", "DevOps Engineer", "Site Reliability Engineer", "Cloud Engineer",
  "Cloud Architect", "Solutions Architect", "Enterprise Architect", "Platform Engineer",
  "QA Engineer", "Test Analyst", "Automation Tester", "Systems Administrator", "Systems Engineer",
  "Network Engineer", "Network Administrator", "IT Support Officer", "Help Desk Analyst",
  "Service Desk Analyst", "Desktop Support Technician", "IT Manager", "IT Project Manager",
  "Cyber Security Analyst", "Security Engineer", "Penetration Tester", "Engineering Manager",
  "Technical Lead", "Scrum Master", "Agile Coach", "Product Manager", "Product Owner",
  "Technical Writer", "ERP Consultant", "Salesforce Administrator", "Salesforce Developer",
  "SAP Consultant", "Graduate Software Engineer",
  // Design & creative
  "UX Designer", "UI Designer", "Product Designer", "UX Researcher", "Graphic Designer",
  "Visual Designer", "Motion Designer", "Content Designer", "Interior Designer", "Architect",
  "Architectural Drafter", "Photographer", "Videographer", "Video Editor", "Animator", "Illustrator",
  "Art Director", "Creative Director", "Copywriter", "Content Writer", "Editor", "Journalist",
  // Marketing, sales & communications
  "Marketing Coordinator", "Marketing Manager", "Marketing Officer", "Marketing Assistant",
  "Digital Marketing Specialist", "Digital Marketing Manager", "Social Media Manager",
  "Social Media Coordinator", "Content Marketing Manager", "SEO Specialist", "Performance Marketing Manager",
  "Brand Manager", "Communications Officer", "Communications Manager", "Communications Advisor",
  "Public Relations Manager", "Media Advisor", "Events Coordinator", "Events Manager",
  "Sales Representative", "Sales Consultant", "Sales Manager", "Sales Assistant", "Account Manager",
  "Key Account Manager", "Account Executive", "Business Development Representative",
  "Sales Development Representative", "Territory Manager", "Real Estate Agent", "Property Manager",
  "Leasing Consultant", "Customer Success Manager", "Telesales Representative",
  // Finance, accounting & banking
  "Accountant", "Senior Accountant", "Management Accountant", "Financial Accountant",
  "Assistant Accountant", "Graduate Accountant", "Accounts Payable Officer", "Accounts Receivable Officer",
  "Accounts Officer", "Bookkeeper", "Payroll Officer", "Payroll Administrator", "Financial Analyst",
  "Finance Manager", "Finance Business Partner", "Financial Controller", "Credit Controller",
  "Credit Analyst", "Tax Accountant", "Tax Consultant", "Auditor", "Internal Auditor",
  "External Auditor", "Financial Planner", "Financial Adviser", "Paraplanner", "Mortgage Broker",
  "Loan Officer", "Lending Manager", "Bank Teller", "Customer Banker", "Relationship Manager",
  "Investment Analyst", "Portfolio Manager", "Actuary", "Insurance Broker", "Claims Officer",
  "Claims Consultant", "Underwriter", "Economist",
  // HR & recruitment
  "HR Advisor", "HR Business Partner", "HR Coordinator", "HR Manager", "HR Officer",
  "HR Administrator", "People and Culture Advisor", "People and Culture Manager", "Recruiter",
  "Recruitment Consultant", "Recruitment Coordinator", "Talent Acquisition Specialist",
  "Talent Acquisition Partner", "Learning and Development Specialist", "Training Coordinator",
  "Workplace Health and Safety Officer", "WHS Advisor", "Industrial Relations Advisor",
  // Healthcare & medical
  "Registered Nurse", "Enrolled Nurse", "Clinical Nurse Specialist", "Nurse Unit Manager",
  "Nurse Practitioner", "Midwife", "Mental Health Nurse", "Aged Care Nurse", "Theatre Nurse",
  "General Practitioner", "Medical Officer", "Resident Medical Officer", "Registrar", "Surgeon",
  "Psychiatrist", "Anaesthetist", "Physiotherapist", "Occupational Therapist", "Speech Pathologist",
  "Psychologist", "Clinical Psychologist", "Dietitian", "Podiatrist", "Chiropractor", "Osteopath",
  "Exercise Physiologist", "Pharmacist", "Pharmacy Assistant", "Dentist", "Dental Assistant",
  "Dental Hygienist", "Optometrist", "Radiographer", "Sonographer", "Paramedic",
  "Medical Receptionist", "Medical Scientist", "Laboratory Technician", "Pathology Collector",
  "Veterinarian", "Vet Nurse", "Health Manager", "Practice Manager", "Clinical Coder",
  "Patient Services Assistant", "Wardsperson",
  // Aged care, disability & community
  "Aged Care Worker", "Personal Care Assistant", "Personal Care Worker", "Disability Support Worker",
  "Support Worker", "Support Coordinator", "Community Support Worker", "Care Manager",
  "Lifestyle Coordinator", "Social Worker", "Case Manager", "Youth Worker", "Community Development Officer",
  "Counsellor", "Mental Health Support Worker", "NDIS Support Coordinator", "Family Support Worker",
  "Residential Care Worker", "Home Care Worker",
  // Education & childcare
  "Primary School Teacher", "Secondary School Teacher", "High School Teacher", "Teacher",
  "Relief Teacher", "Early Childhood Teacher", "Early Childhood Educator", "Childcare Educator",
  "Childcare Centre Director", "Room Leader", "Teacher's Aide", "Education Support Officer",
  "Learning Support Assistant", "Special Education Teacher", "School Principal", "Deputy Principal",
  "Tutor", "Lecturer", "Senior Lecturer", "Research Assistant", "Research Fellow", "Trainer and Assessor",
  "Instructional Designer", "Librarian", "Library Technician", "Student Services Officer",
  "Outside School Hours Care Educator", "Nanny",
  // Hospitality & tourism
  "Chef", "Head Chef", "Sous Chef", "Chef de Partie", "Commis Chef", "Cook", "Kitchen Hand",
  "Barista", "Bartender", "Waiter", "Waitress", "Food and Beverage Attendant", "Restaurant Manager",
  "Cafe Manager", "Bar Manager", "Venue Manager", "Front of House Manager", "Duty Manager",
  "Hotel Manager", "Front Office Manager", "Front Desk Agent", "Hotel Receptionist", "Concierge",
  "Housekeeper", "Room Attendant", "Catering Assistant", "Event Staff", "Travel Consultant",
  "Tour Guide", "Pastry Chef", "Baker", "Butcher",
  // Retail
  "Retail Assistant", "Sales Associate", "Store Manager", "Assistant Store Manager", "Retail Manager",
  "Department Manager", "Visual Merchandiser", "Checkout Operator", "Cashier", "Customer Service Assistant",
  "Stock Replenishment Team Member", "Night Fill Team Member", "Store Team Member", "Area Manager",
  "Buyer", "Merchandise Planner", "Beauty Advisor", "Pharmacy Retail Assistant",
  // Trades & construction
  "Electrician", "Apprentice Electrician", "Plumber", "Apprentice Plumber", "Carpenter",
  "Apprentice Carpenter", "Builder", "Bricklayer", "Tiler", "Painter", "Plasterer", "Roofer",
  "Glazier", "Cabinet Maker", "Joiner", "Landscaper", "Gardener", "Arborist", "Welder",
  "Boilermaker", "Fitter and Turner", "Diesel Mechanic", "Motor Mechanic", "Auto Electrician",
  "Panel Beater", "Spray Painter", "Refrigeration Mechanic", "Air Conditioning Technician",
  "HVAC Technician", "Locksmith", "Handyman", "Labourer", "Construction Labourer", "Site Supervisor",
  "Site Manager", "Construction Manager", "Project Engineer", "Estimator", "Quantity Surveyor",
  "Building Inspector", "Scaffolder", "Rigger", "Concreter", "Traffic Controller", "Crane Operator",
  "Excavator Operator", "Plant Operator", "Maintenance Technician", "Maintenance Planner",
  "Facilities Manager", "Facilities Coordinator",
  // Engineering, science & mining
  "Civil Engineer", "Structural Engineer", "Mechanical Engineer", "Electrical Engineer",
  "Chemical Engineer", "Environmental Engineer", "Geotechnical Engineer", "Mining Engineer",
  "Process Engineer", "Manufacturing Engineer", "Industrial Engineer", "Biomedical Engineer",
  "Design Engineer", "Drafter", "Surveyor", "Geologist", "Hydrogeologist", "Environmental Scientist",
  "Environmental Officer", "Sustainability Manager", "Chemist", "Laboratory Manager", "Scientist",
  "Research Scientist", "Metallurgist", "Mine Supervisor", "Underground Miner", "Driller",
  "Drill Offsider", "Dump Truck Operator", "FIFO Operator", "Graduate Engineer",
  // Transport, logistics & warehousing
  "Truck Driver", "Delivery Driver", "Courier", "Bus Driver", "Forklift Driver", "Forklift Operator",
  "Warehouse Worker", "Warehouse Assistant", "Warehouse Supervisor", "Warehouse Manager",
  "Storeperson", "Pick Packer", "Logistics Coordinator", "Logistics Manager", "Supply Chain Analyst",
  "Supply Chain Manager", "Inventory Controller", "Purchasing Officer", "Freight Forwarder",
  "Customs Broker", "Dispatcher", "Fleet Manager", "Transport Planner", "Pilot", "Flight Attendant",
  "Train Driver", "Rideshare Driver",
  // Manufacturing & production
  "Production Worker", "Process Worker", "Machine Operator", "Production Supervisor",
  "Production Manager", "Quality Assurance Officer", "Quality Control Inspector", "Quality Manager",
  "Assembler", "Packer", "Food Process Worker", "Continuous Improvement Manager",
  // Legal
  "Lawyer", "Solicitor", "Senior Associate", "Barrister", "Paralegal", "Legal Assistant",
  "Legal Secretary", "Law Clerk", "Conveyancer", "In-house Counsel", "Legal Counsel",
  "Graduate Lawyer",
  // Government, safety & security
  "Police Officer", "Firefighter", "Correctional Officer", "Security Officer", "Security Guard",
  "Customs Officer", "Defence Force Member", "Emergency Services Officer", "Council Officer",
  "Ranger", "Parking Inspector",
  // Cleaning & services
  "Cleaner", "Commercial Cleaner", "Domestic Cleaner", "Cleaning Supervisor", "Laundry Attendant",
  "Hairdresser", "Barber", "Beauty Therapist", "Nail Technician", "Makeup Artist", "Massage Therapist",
  "Personal Trainer", "Fitness Instructor", "Swim Teacher", "Lifeguard", "Sports Coach",
  "Dog Groomer", "Pet Sitter",
  // Agriculture
  "Farm Hand", "Farm Manager", "Fruit Picker", "Station Hand", "Agronomist", "Horticulturist",
  "Viticulturist", "Stockperson",
  // Entry level
  "Graduate", "Intern", "Apprentice", "Trainee", "Casual Team Member", "Volunteer",
];

/** Titles matching what's been typed, as dropdown suggestions. `exclude` skips titles already chosen. */
export function suggestJobTitles(query: string, exclude: readonly string[] = []): { value: string }[] {
  return suggestFromList(query, JOB_TITLE_CATALOG, exclude).map((value) => ({ value }));
}
