import { notFound } from "next/navigation";
import { getTemplateDefinition, isValidTemplate } from "@/lib/resume/templateRegistry";
import { MARGIN_MM } from "@/lib/resume/designPrefs";
import type { ResumeContent } from "@/types";

// Fictional sample candidate for the home page template thumbnails.
const SAMPLE_RESUME: ResumeContent = {
  contact: {
    name: "Alex Wright",
    phone: "0412 884 921",
    email: "alex.wright@example.com",
    location: "Melbourne VIC",
    linkedin: "linkedin.com/in/alexwright",
    work_rights: "Australian Citizen",
  },
  target_titles: ["Operations Coordinator", "Logistics Coordinator"],
  summary:
    "Operations coordinator with 6 years in retail and e-commerce fulfilment across Melbourne. Experienced in order processing, carrier management and stock reporting for multi-site teams.",
  skills: ["Order Processing", "Carrier Management", "Stock Reconciliation", "Team Rostering", "Supplier Liaison", "Escalation Handling"],
  tools: ["Fulfilment: Shippit, eStar, Australia Post MyPost", "Reporting: Excel, Power BI"],
  experience: [
    {
      job_title: "Operations Coordinator",
      company: "Northside Retail Group",
      company_description: "",
      location: "Melbourne VIC",
      start_date: "Mar 2022",
      end_date: "Present",
      bullets: [
        "Coordinate order fulfilment for 800+ brands across pick, pack and dispatch using eStar and Shippit.",
        "Reconcile weekly stock counts across 3 warehouses, cutting variance from 4% to 1.5%.",
        "Roster a team of 12 casual pickers to cover peak trading periods.",
        "Resolve carrier escalations with Australia Post and StarTrack for delayed consignments.",
      ],
    },
    {
      job_title: "Warehouse Team Leader",
      company: "Harbourside Distribution",
      company_description: "",
      location: "Dandenong VIC",
      start_date: "Jan 2019",
      end_date: "Feb 2022",
      bullets: [
        "Led a team of 8 across inbound receiving and outbound dispatch.",
        "Trained new starters on scanning procedures and WHS standards.",
        "Built a daily dispatch report in Excel used by the site manager.",
      ],
    },
    {
      job_title: "Customer Service Assistant",
      company: "Coastline Hardware",
      company_description: "",
      location: "Frankston VIC",
      start_date: "Jun 2016",
      end_date: "Dec 2018",
      bullets: ["Handled phone and counter enquiries for trade and retail customers.", "Processed returns and special orders in the POS system."],
    },
  ],
  projects: [],
  education: [
    { degree: "Certificate IV in Warehousing Operations", institution: "Chisholm Institute", year: "2019", notes: "" },
    { degree: "Bachelor of Business", institution: "Deakin University", year: "2013 - 2016", notes: "" },
  ],
  referees: [],
};

/**
 * Dev-only A4 render of one real resume template on sample data, screenshotted by
 * scripts/render-templates.mjs into public/templates/ for the home page Templates section, so the
 * thumbnails always show the actual templates. Not served in production.
 */
export default async function TemplateThumbnailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (process.env.NODE_ENV === "production") notFound();
  if (!isValidTemplate(params.id)) notFound();

  const { component: Template } = getTemplateDefinition(params.id);
  return (
    <div
      data-thumbnail
      style={{ width: "210mm", height: "297mm", padding: `${MARGIN_MM.standard}mm`, background: "#ffffff", overflow: "hidden" }}
    >
      <Template resume={SAMPLE_RESUME} />
    </div>
  );
}
