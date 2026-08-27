import { BlogPost, BlogCategoryMeta } from "./types";

export const BLOG_CATEGORIES: BlogCategoryMeta[] = [
  {
    id: "all",
    label: "All Guides",
    description: "All Australian career advice, ATS optimization strategies, and job-hunting playbooks.",
  },
  {
    id: "resumes",
    label: "Resumes & Formatting",
    description: "Australian standard resume formats, structure, bullet formulas, and A4 layout rules.",
  },
  {
    id: "selection-criteria",
    label: "APS & Selection Criteria",
    description: "Addressing Key Selection Criteria (KSC) for Australian Public Service and state government roles.",
  },
  {
    id: "ats-platforms",
    label: "SEEK & ATS Systems",
    description: "How Workday, Taleo, and SEEK AI screening algorithms parse and score Australian applications.",
  },
  {
    id: "interviews-salaries",
    label: "Interviews & Salaries",
    description: "STAR method interview preparation, Australian salary benchmarks, and superannuation negotiation.",
  },
];

export const BLOG_AUTHORS = {
  lachlan: {
    name: "Lachlan Evans",
    role: "Former Sydney Tech Recruiter & Career Strategist",
    initials: "LE",
    bio: "Lachlan has screened over 25,000 Australian resumes across ASX 100 enterprises and hyper-growth tech startups. He specializes in ATS optimization and salary negotiation.",
  },
  sarah: {
    name: "Dr. Sarah Jenkins",
    role: "Government Hiring Advisor & Public Sector Specialist",
    initials: "SJ",
    bio: "Sarah served on Australian Public Service (APS) selection panels across Canberra and Melbourne for over a decade. She coaches professionals on cracking government merit-based recruitment.",
  },
  applylab: {
    name: "ApplyLab Research Team",
    role: "Data & AI Career Intelligence",
    initials: "AL",
    bio: "The ApplyLab editorial team analyzes live Australian job market trends across SEEK, LinkedIn, and corporate Workday portals to publish verified career intelligence.",
  },
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "australian-resume-format-guide-2026",
    title: "The Complete Australian Resume Format Guide (2026 Edition)",
    subtitle: "What Australian recruiters and ATS software expect: page length, layout standards, and the exact bullet-point formula that lands interviews.",
    metaDescription: "Master the 2026 Australian resume format. Learn standard page lengths, contact details, A4 layout guidelines, and ATS optimization rules for SEEK and LinkedIn.",
    publishedAt: "2026-08-15",
    updatedAt: "2026-08-25",
    readingTimeMinutes: 7,
    category: "resumes",
    categoryLabel: "Resumes & Formatting",
    tags: ["Resume Format", "Australia Job Market", "SEEK", "ATS Friendly", "A4 Format"],
    featured: true,
    author: BLOG_AUTHORS.lachlan,
    targetAudience: "Australian job seekers, skilled migrants, and professionals updating their resume for the Australian job market.",
    keyTakeaways: [
      "Australian resumes default to 1-2 pages (rarely 3 unless senior executive or academic).",
      "Do NOT include photos, age, marital status, or full street addresses on Australian resumes.",
      "Use Australian spelling (e.g., 'optimised', 'analysed', 'programmes') throughout your document.",
      "Quantify your bullet points using the Action + Context + Result (ACR) framework.",
      "Ensure your PDF is formatted for A4 paper dimensions, not US Letter.",
    ],
    tableOfContents: [
      { id: "australian-resume-fundamentals", title: "1. The Fundamentals of an Australian Resume", level: 2 },
      { id: "what-to-include-vs-omit", title: "2. What to Include vs. What to Omit", level: 2 },
      { id: "standard-section-order", title: "3. Ideal Section Hierarchy", level: 2 },
      { id: "bullet-point-formula", title: "4. The ACR Bullet-Point Formula", level: 2 },
      { id: "ats-formatting-rules", title: "5. ATS-Safe Formatting Checklist", level: 2 },
      { id: "common-mistakes-australia", title: "6. Top Mistakes Overseas Applicants Make", level: 2 },
    ],
    content: `
If you are applying for jobs in Australia, submitting an American-style 1-page US Letter resume or a multi-page European CV with a headshot will dramatically reduce your callback rate.

Australian recruiters and Applicant Tracking Systems (ATS) have distinct expectations around formatting, terminology, length, and personal disclosures.

In this guide, we break down exactly how to structure an Australian resume that passes automated parsing and captures a hiring manager's attention within the first 6-second scan.

---

## 1. The Fundamentals of an Australian Resume

In Australia, the terms **"Resume"** and **"CV"** (Curriculum Vitae) are used interchangeably for standard corporate, technical, and trade roles. 

Here are the baseline rules:

- **Page Length:** 
  - Early to Mid-Career (0–7 years experience): **Strictly 1 to 2 pages**.
  - Senior Managers & Executives (8+ years): **2 pages** (maximum 3 pages if you have extensive publications or board appointments).
- **Document Dimensions:** Always format your document for **A4 page size** (210 × 297 mm). Submitting US Letter (8.5 × 11 in) often results in awkward pagination cutoffs when printed in Australian offices.
- **File Format:** Always submit as a clean **PDF** unless the job ad explicitly requests a \`.docx\` Word document.

> 🇦🇺 **AUSTRALIAN MARKET INSIGHT:**  
> Australian hiring managers value brevity. 72% of Australian tech and corporate recruiters state they reject resumes that exceed 3 pages for non-executive roles.

---

## 2. What to Include vs. What to Omit

Australia enforces strict anti-discrimination legislation (the *Fair Work Act 2009* and *Age Discrimination Act 2004*). As a result, standard Australian resumes exclude personal demographic data that could introduce unconscious bias.

### ✅ What MUST Be Included:
1. **Full Name & Target Role Title:** Bold and prominent at the top.
2. **Contact Details:** Phone number (Australian \`+61\` format or local \`04xx xxx xxx\`), professional email, city/state (e.g., *Sydney, NSW* or *Melbourne, VIC*), and your customized LinkedIn profile URL.
3. **Work Rights / Visa Status:** If you hold Australian Citizenship, Permanent Residency (PR), or a Valid Working Visa (e.g., TSS 482, Working Holiday 417), state it clearly in your header or summary.
4. **Professional Summary:** 3–4 concise lines summarizing your core expertise, years of experience, and primary value proposition.
5. **Key Skills & Competencies:** A bulleted list of 8–12 hard skills and domain tools matching the target job specification.
6. **Professional Experience:** Reverse-chronological history with clear metrics and outcomes.
7. **Education & Certifications:** Australian equivalent degrees, formal qualifications, and accredited licenses (e.g., CPA, PMP, AWS Certified).

### ❌ What You MUST OMIT:
- **Profile Photo / Headshot:** Never include your photograph unless you are auditioning for an acting or modelling role.
- **Date of Birth / Age:** Omit completely.
- **Marital Status, Religion, Gender, or Nationality:** Omit completely.
- **Full Residential Street Address:** Simply list \`Suburb, State Postcode\` (e.g., *Surry Hills, NSW 2010*).
- **References on Request:** Omit the phrase *"References available upon request"*. It is considered outdated filler. Australian employers will request referees during the offer stage.

---

## 3. Ideal Section Hierarchy

Follow this proven section hierarchy for maximum readability:

1. **Header:** Name, Target Title, Contact Details, Australian Work Rights.
2. **Professional Profile / Executive Summary:** 3-4 punchy sentences.
3. **Core Skills & Technical Competencies:** 2-column or 3-column pill grid.
4. **Work Experience:**
   - Role Title, Company Name, Location, Employment Dates (Month Year – Month Year).
   - 1-sentence company/team context.
   - 4–6 outcome-driven bullet points per role.
5. **Education & Formal Qualifications:** Degree, Institution Name, Graduation Year.
6. **Certifications & Professional Memberships:** E.g., Scrum Alliance CSM, ACS Membership.

---

## 4. The ACR Bullet-Point Formula (Action + Context + Result)

The biggest weakness on most Australian resumes is writing task-focused job descriptions rather than outcome-driven achievements.

Use the **ACR Framework** for every bullet point:

$$\\text{Strong Action Verb} + \\text{Business Context / Problem} + \\text{Measurable Metric / Commercial Result}$$

### Comparison Example:

| ❌ Weak (Task-Oriented) | ✅ Strong (Australian ACR Formula) |
| :--- | :--- |
| *Responsible for managing company Google Ads campaigns and SEO.* | *Architected and scaled multi-channel Google Ads campaigns across APAC, reducing Customer Acquisition Cost (CAC) by 28% and generating $420k in new ARR.* |
| *Assisted customers with banking queries over the phone.* | *Handled 65+ Tier-2 escalated customer banking inquiries daily, maintaining a 96.4% First Contact Resolution (FCR) score across 14 consecutive months.* |
| *Wrote unit tests for frontend React applications.* | *Authored automated Jest test suites covering 88% of core checkout flows, reducing production bug regressions by 34% ahead of the FY26 product launch.* |

---

## 5. ATS-Safe Formatting Checklist

Most major Australian employers (Commonwealth Bank, Telstra, Atlassian, Woolworths, Deloitte) use **Workday**, **Taleo**, **SuccessFactors**, or **PageUp** to parse incoming resumes.

To ensure your resume passes ATS parsers with 100% accuracy:

- **Avoid 2-Column Tables:** Complex multi-column CSS tables and nested text boxes often cause ATS parsers to read text horizontally across columns, scrambling your work history.
- **Standard Headings:** Use standard section names: \`Professional Experience\`, \`Education\`, \`Skills\`, \`Certifications\`. Avoid creative names like \`My Journey\` or \`Where I've Been\`.
- **Standard Fonts:** Stick to clean, universally rendered fonts: *IBM Plex Sans, Inter, Roboto, Arial, Calibri, or Georgia*.
- **Australian English Spelling:** Check your document with an Australian English dictionary (\`optimise\`, \`prioritise\`, \`centre\`, \`modelling\`).

---

## 6. Top Mistakes Overseas Applicants Make

If you are an international candidate or skilled migrant relocating to Australia, be mindful of these common traps:

1. **Not Clarifying Australian Work Rights:** Australian recruiters will often discard applications that do not explicitly state work rights (e.g., *"Full Australian Working Rights (PR Visa 189)"* or *"Australian Citizen"*).
2. **Using Foreign Acronyms without Context:** If you worked for a major overseas firm not known in Australia, add a brief 1-sentence descriptor (e.g., *"FinTech Corp — India's largest B2B payments gateway with 12M monthly active users"*).
3. **Submitting 5-Page Resumes:** In many Asian and European countries, comprehensive 4–6 page CVs listing every project are standard. In Australia, condense your experience to the most relevant 10–12 years across 2 pages maximum.

---

### Summary Checklist Before Applying:
- [ ] Document is formatted in **A4 dimensions**.
- [ ] Length is **1 to 2 pages maximum**.
- [ ] No photos, age, marital status, or full street address.
- [ ] Work rights status is clearly stated in the top header.
- [ ] All bullet points follow the **ACR (Action-Context-Result)** formula with numbers/percentages.
- [ ] Tailored directly to the keywords in the target SEEK / LinkedIn job advertisement.
`,
  },
  {
    slug: "how-to-address-key-selection-criteria-aps",
    title: "How to Address Key Selection Criteria (KSC) for Australian Government & APS Jobs",
    subtitle: "A step-by-step masterclass on writing compelling, merit-based responses using the STAR and SAO models for state and federal public service roles.",
    metaDescription: "Learn how to write winning Key Selection Criteria (KSC) responses for Australian Public Service (APS) and state government jobs with real STAR method examples.",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-26",
    readingTimeMinutes: 8,
    category: "selection-criteria",
    categoryLabel: "APS & Selection Criteria",
    tags: ["Selection Criteria", "APS Jobs", "Government", "STAR Method", "Canberra"],
    featured: false,
    author: BLOG_AUTHORS.sarah,
    targetAudience: "Applicants targeting Australian Public Service (APS), state government (NSW, VIC, QLD), university, or local council roles.",
    keyTakeaways: [
      "APS recruitment is governed by the 'Merit Principle' under the Public Service Act 1999.",
      "Never answer selection criteria in generic prose; use structured subheadings with the STAR or SAO method.",
      "Align your responses directly with the APS Work Level Standards (APS 4-6, EL 1-2) and Integrated Leadership System (ILS).",
      "Strictly adhere to word counts (e.g., 500-word limit or 1000-word statement of claims).",
      "Highlight your individual actions ('I designed', 'I initiated') rather than collective team efforts ('We did').",
    ],
    tableOfContents: [
      { id: "understanding-merit-principle", title: "1. The Merit Principle in Government Hiring", level: 2 },
      { id: "star-vs-sao-model", title: "2. The STAR & SAO Structuring Models", level: 2 },
      { id: "breaking-down-criteria", title: "3. Deconstructing a Selection Criterion", level: 2 },
      { id: "full-example-response", title: "4. Full Word-for-Word KSC Example Response", level: 2 },
      { id: "common-ksc-traps", title: "5. Five Mistakes Selection Panels Reject", level: 2 },
    ],
    content: `
Applying for government roles in Australia—whether for the **Australian Public Service (APS)**, state departments (such as NSW Health or Victorian Government), local councils, or universities—is vastly different from applying to private corporate roles.

Government applications require you to formally address **Key Selection Criteria (KSC)** or write a comprehensive **Statement of Claims**.

Selection panels are legally mandated to assess all candidates under the **Merit Principle** (*Public Service Act 1999*). If your selection criteria responses fail to score above the minimum benchmark on the panel's grading rubric, your application cannot progress to interview—regardless of how impressive your resume is.

---

## 1. The Merit Principle in Government Hiring

In Australian public sector recruitment:
- Every applicant is scored numerically against predefined capabilities.
- The panel must produce an auditable selection report justifying why the successful candidate demonstrated superior capability.
- The **Integrated Leadership System (ILS)** and **Work Level Standards (WLS)** define what is expected at each level (from APS 1 up to SES Executive levels).

> 💡 **PRO TIP FOR APS APPLICATIONS:**  
> When applying for APS 5 vs. EL 1 (Executive Level 1), the panel looks for strategic leadership and autonomy. Ensure your examples demonstrate leadership scope matching the targeted APS classification.

---

## 2. The STAR & SAO Structuring Models

To score maximum points, your responses must provide concrete behavioral evidence. Never make unsupported assertions like *"I possess outstanding stakeholder engagement skills"*. Instead, prove it with a structured scenario.

### The STAR Framework:
- **S – Situation:** Set the scene in 1–2 sentences (Role, organisation, project, time period).
- **T – Task:** What was your specific objective, challenge, or mandate?
- **A – Action (60% of your response):** What exact steps did **you** take? Detail your strategy, problem-solving, stakeholder negotiations, and technical tools.
- **R – Result:** What was the measurable outcome? What did the department or community gain?

---

## 3. Deconstructing a Selection Criterion

Let's look at a common APS criterion:

> **Criterion:** *"Demonstrated ability to manage competing priorities, deliver high-quality outputs under pressure, and engage effectively with internal and external stakeholders."*

Notice that this is actually **three criteria in one**:
1. Managing competing priorities / working under pressure.
2. Delivering high-quality outputs.
3. Effective stakeholder engagement.

If you only discuss time management and ignore stakeholder negotiation, you will lose 33% of the available marks on the scoring matrix.

---

## 4. Full Word-for-Word KSC Example Response

Here is a model 350-word response for an **APS 6 Project Officer** position:

\`\`\`markdown
### Criterion: Demonstrated ability to manage complex project deliverables and engage diverse stakeholders under tight deadlines.

**Situation & Task:**
As Senior Project Officer at the Department of Transport (2025), I was tasked with delivering a critical digital ticketing compliance audit across 14 regional transport hubs within an accelerated 8-week timeframe, 4 weeks ahead of the standard legislative reporting cycle.

**Action:**
To execute this under stringent deadlines, I undertook the following steps:
1. **Prioritisation & Governance:** I created a dynamic RAID log and reallocated team sprints, identifying 3 critical path dependencies that posed immediate delivery risks.
2. **Stakeholder Collaboration:** I established weekly hybrid briefing sessions with 12 regional hub directors and key software vendors to establish agreed telemetry data standards and eliminate reporting bottlenecks.
3. **Process Optimisation:** When manual data verification caused early delays, I designed an automated Python validation script that accelerated raw transit log processing by 70%, ensuring data integrity met National Transport Commission benchmarks.

**Result:**
The final compliance audit report was submitted to the Deputy Secretary 4 days ahead of schedule with zero compliance defects. The automated validation framework was subsequently adopted across all 5 state transport divisions, saving an estimated 120 operational hours per quarterly audit cycle.
\`\`\`

---

## 5. Five Mistakes Selection Panels Reject

1. **Using "We" Instead of "I":** Panels are evaluating **you**, not your team. If you write *"We designed a new policy and we presented it"*, the assessor cannot distinguish your individual contribution.
2. **Exceeding Word Limits:** If the job pack specifies a 500-word limit per criterion or a 2-page pitch, cutting off text beyond the limit is strictly enforced.
3. **Hypothetical Answers:** Never write *"In this situation, I would usually conduct a meeting..."*. Government panels only award marks for historical, verified events.
4. **Ignoring Negative Situations:** If a project encountered obstacles, discuss how you navigated the impediment. Selection panels value resilience and risk management.
5. **Failing to Link to Departmental Objectives:** Connect your results to the broader public interest, service delivery, or departmental policy goals.
`,
  },
  {
    slug: "beat-workday-seek-ats-australia",
    title: "How to Beat Workday & SEEK ATS in Australia: The Truth About Screening Algorithms",
    subtitle: "Understand how Australian enterprise Applicant Tracking Systems parse resumes, calculate candidate fit scores, and screen out qualified applicants.",
    metaDescription: "Learn how Workday, Taleo, and SEEK AI screening algorithms parse resumes in Australia. Actionable tips to format ATS-compliant resumes that get seen by humans.",
    publishedAt: "2026-08-20",
    updatedAt: "2026-08-26",
    readingTimeMinutes: 6,
    category: "ats-platforms",
    categoryLabel: "SEEK & ATS Systems",
    tags: ["Workday", "SEEK", "ATS Optimization", "Job Applications", "Australia"],
    featured: false,
    author: BLOG_AUTHORS.applylab,
    targetAudience: "Job seekers applying to enterprise companies, banks, consulting firms, and SEEK job listings in Australia.",
    keyTakeaways: [
      "Over 85% of ASX 200 companies use enterprise ATS platforms like Workday, SuccessFactors, or PageUp.",
      "ATS algorithms match keyword frequency, semantic synonyms, job title proximity, and date sequences.",
      "Complex Canva graphics, dual-column floating tables, and header/footer text often break resume parsers completely.",
      "SEEK's candidate matching algorithm scores your profile based on keywords extracted from the first 500 words of your resume.",
      "Tailoring your resume keywords to each specific job description is the single highest-ROI activity in your job search.",
    ],
    tableOfContents: [
      { id: "how-ats-works-australia", title: "1. How Australian ATS Platforms Actually Work", level: 2 },
      { id: "the-seek-ai-algorithm", title: "2. The SEEK Candidate Matching Engine", level: 2 },
      { id: "design-elements-that-break-parsers", title: "3. 6 Design Elements That Break Parsers", level: 2 },
      { id: "keyword-optimisation-strategy", title: "4. Semantic Keyword Optimization Strategy", level: 2 },
      { id: "ats-scoring-rubric", title: "5. The Recruiter's Screen View", level: 2 },
    ],
    content: `
If you have applied for dozens of roles on **SEEK**, **LinkedIn**, or directly via corporate **Workday** portals without receiving an interview invite, there is a high probability your resume is being filtered out by automated parsers before a human recruiter even sees it.

In Australia, virtually all major employers—including the Big Four banks (CBA, Westpac, NAB, ANZ), Coles, Woolworths, Telstra, BHP, and government agencies—use ATS platforms to handle thousands of inbound applications.

Here is an insider breakdown of how these algorithms function and how to optimize your resume to pass through every time.

---

## 1. How Australian ATS Platforms Actually Work

When you upload your resume to a portal like Workday, the software does not look at your document as a visual PDF. Instead:

1. **Text Extraction:** An OCR/text parser strips away all formatting, background colors, and graphics, converting your resume into a raw plain-text string.
2. **Entity Recognition & Tagging:** The parser identifies key entities: *Contact Details, Job Titles, Company Names, Employment Dates, Skill Keywords, Education*.
3. **Search & Score Indexing:** When the recruiter opens the job requisition, the ATS displays candidates ranked by a **Fit / Match Percentage** based on the recruiter's search criteria.

If the parser cannot extract your role dates or misses your hard skills because they were trapped in a nested Canva graphic, your profile will be assigned a 20% match score and buried on page 5 of the recruiter's dashboard.

---

## 2. The SEEK Candidate Matching Engine

SEEK is Australia's largest job platform. When employers post a role on SEEK, SEEK's automated matching engine instantly scans all applicants and categorizes them into:
- **Strong Match** (Notified immediately to the hiring manager)
- **Potential Match**
- **Unlikely Match**

### How SEEK Evaluates Your Application:
- **Location Alignment:** Proximity to the advertised role location (e.g. within 25km of Sydney CBD).
- **Core Role Title Match:** Whether your past job titles share semantic similarity with the advertised vacancy.
- **Keyword Density:** Frequency of required certifications (e.g., *CPA, AWS Solutions Architect, PRINCE2, AHPRA Registration*) in your uploaded resume.
- **Screening Question Responses:** Answers to mandatory questions (e.g., *"Do you have Australian work rights?"*, *"How many years of experience do you have with Salesforce?"*).

---

## 3. 6 Design Elements That Break Parsers

Avoid these visual design traps that frequently corrupt ATS data:

1. **Floating Text Boxes & Sidebars:** ATS parsers read left-to-right, top-to-bottom. Two-column sidebars cause the parser to merge left-column skills with right-column company names.
2. **Placing Contact Info in Header/Footer Areas:** Many parsers ignore Microsoft Word and PDF header/footer zones entirely, causing your phone number and email to disappear.
3. **Skill Rating Bars (e.g., 5/5 stars or 85% progress bar):** An algorithm cannot interpret visual circles or colored bars for skills.
4. **Icons Instead of Text:** Using a phone icon instead of writing \`Phone:\` or \`+61\` can prevent the parser from registering your phone number.
5. **Complex Tables:** Embedded tables with invisible borders often scramble chronological work dates.
6. **Images of Text or Certificates:** Text embedded inside JPG/PNG images is completely invisible to standard ATS parsers.

---

## 4. Semantic Keyword Optimization Strategy

Beating the ATS does not mean stuffing white text keywords at the bottom of your resume (a legacy trick that modern algorithms immediately flag as spam).

Instead, follow this semantic alignment method:

1. **Identify the Top 6 Hard Skills:** Extract the non-negotiable tools and domain skills directly from the "Requirements" or "About You" section of the job ad.
2. **Mirror Industry Terminology:** If the Australian ad asks for \`Stakeholder Engagement\`, do not simply write \`Client Relationship Management\`. Include both variations.
3. **Contextualize Every Keyword:** Rather than listing a keyword once in a skills cloud, reference it in your work experience bullets alongside a metric outcome.

---

## 5. The Recruiter's Screen View

Recruiters do not read resumes top-to-bottom on their initial pass. They view a summary card showing:
- Candidate Name & Location
- Most Recent Job Title & Tenure
- Top Matched Skills & Keywords
- Match Score (e.g., 94%)

When you optimize your resume structure and tailor your bullet points with ApplyLab, your application ranks in the top 5% of candidate matches, ensuring human review and rapid interview callbacks.
`,
  },
  {
    slug: "australian-tech-salary-negotiation-guide",
    title: "Australian Tech & Corporate Salary Negotiation Guide: Packages, Super & Equity",
    subtitle: "How to negotiate your compensation package in Australia. Understanding base salary, superannuation guarantee, STI/LTI bonuses, and equity grants.",
    metaDescription: "Master Australian salary negotiation in 2026. Understand Superannuation Guarantee (11.5%+), gross vs total package, performance bonuses, and tax considerations.",
    publishedAt: "2026-08-22",
    updatedAt: "2026-08-26",
    readingTimeMinutes: 7,
    category: "interviews-salaries",
    categoryLabel: "Interviews & Salaries",
    tags: ["Salary Negotiation", "Superannuation", "Tech Salaries Australia", "Job Offer", "Careers"],
    featured: false,
    author: BLOG_AUTHORS.lachlan,
    targetAudience: "Australian corporate and technology professionals evaluating job offers or preparing for annual salary reviews.",
    keyTakeaways: [
      "Always clarify whether an Australian salary offer is 'Base + Super' or 'Total Remuneration Package (TRP) inclusive of Super'.",
      "The Australian Superannuation Guarantee is mandated by law (increasing toward 12%).",
      "Anchor your negotiation using verified Australian market benchmark bands (Hays, Michael Page, Levels.fyi AU).",
      "Non-salary variables like flexible working arrangements, additional annual leave, and sign-on bonuses are powerful levers.",
      "Never disclose your current salary or give a rigid number during initial recruiter screening calls.",
    ],
    tableOfContents: [
      { id: "understanding-australian-comp-structures", title: "1. Understanding Australian Compensation Structures", level: 2 },
      { id: "base-plus-super-vs-package", title: "2. 'Base + Super' vs. 'Inclusive of Super' Trap", level: 2 },
      { id: "timing-your-negotiation", title: "3. When and How to Negotiate", level: 2 },
      { id: "email-scripts-salary-counter", title: "4. Word-for-Word Negotiation Scripts", level: 2 },
      { id: "non-salary-levers", title: "5. Negotiating Non-Salary Benefits", level: 2 },
    ],
    content: `
Receiving a formal job offer is the moment you possess the greatest leverage in your career. Yet over 60% of Australian professionals accept the first offer on the table without negotiating, leaving tens of thousands of dollars on the table over the lifetime of their employment.

Salary negotiation in Australia has specific legal and structural nuances—most notably the **Superannuation Guarantee**, **Total Remuneration Packages (TRP)**, and **Employee Share Schemes (ESS)**.

Here is how to navigate the negotiation process strategically to maximize your total compensation.

---

## 1. Understanding Australian Compensation Structures

In Australia, compensation packages are typically constructed from four components:

1. **Base Salary:** The guaranteed gross annual cash salary paid in fortnightly or monthly cycles.
2. **Superannuation (Super):** The legally mandated retirement contribution paid by your employer into your nominated super fund (Hostplus, AustralianSuper, ART, etc.).
3. **Short-Term Incentives (STI):** Annual performance cash bonuses tied to personal KPIs and company revenue targets (commonly 10%–30% of base).
4. **Long-Term Incentives (LTI) / Equity:** Stock options or Restricted Stock Units (RSUs) vesting over 3–4 years, common in US tech multinationals and ASX tech firms.

---

## 2. The "Base + Super" vs. "Inclusive of Super" Trap

The most common point of confusion for job seekers in Australia is how the recruiter quotes the headline number.

### Let's look at an offer quoted as "$150,000":

| Offer Wording | Base Salary | Super (11.5%) | Total Received |
| :--- | :--- | :--- | :--- |
| **$150k + Super** | $150,000 | $17,250 | **$167,250** |
| **$150k Package (Inclusive of Super)** | $134,529 | $15,471 | **$150,000** |

> ⚠️ **CRITICAL WARNING:**  
> If an offer is worded as a *"Total Package of $150,000 inclusive of statutory superannuation"*, your take-home base pay is significantly lower than if it were "$150,000 plus super". Always ask the recruiter: *"Is that figure base salary plus super, or total package?"*

---

## 3. When and How to Negotiate

### Rule #1: Defer Salary Discussions Early
During initial recruiter phone screens, recruiters will frequently ask: *"What are your salary expectations?"*

Giving a specific number early boxes you in. If you state $120k and their internal budget was $145k, you just cost yourself $25k.

**Deflection Script:**
> *"I'm currently focused on finding the right role alignment where I can make an immediate impact. Once we determine that there's a mutual fit regarding the responsibilities, I'm confident we can agree on a market-competitive package. What is the approved salary band for this position?"*

### Rule #2: Only Negotiate After the Written Offer
Negotiate only after the hiring team has decided you are their #1 preferred candidate and has extended a formal verbal or written offer. At this stage, they are emotionally and operationally invested in closing your hire.

---

## 4. Word-for-Word Negotiation Scripts

### Scenario: The offer is below market expectations

\`\`\`text
Subject: Re: Offer of Employment - [Your Name] - [Role Title]

Hi [Recruiter / Hiring Manager Name],

Thank you very much for extending the offer for the [Role Title] position. I am truly excited about the opportunity to join [Company Name] and lead the upcoming [Specific Initiative or Project discussed in interview].

I have reviewed the offer details carefully. Based on my [X years] of specialized experience in [Key Domain], my track record of [Specific Measurable Achievement], and current market benchmarks for equivalent roles in Sydney/Melbourne, I was anticipating a base salary closer to [$X,000] plus super.

If we are able to meet at [$X,000] base plus superannuation, I would be thrilled to sign the contract and accept the offer immediately.

Thank you again for your consideration and partnership throughout this process. I look forward to your thoughts.

Kind regards,
[Your Name]
\`\`\`

---

## 5. Negotiating Non-Salary Benefits

If the employer has strict budget constraints on base salary, leverage these high-value alternatives:

- **Sign-on Bonus:** A one-off cash payment (e.g. $10,000–$25,000) that comes from a different talent acquisition budget line.
- **Additional Annual Leave:** Requesting an extra week of paid annual leave (5 weeks total instead of standard 4 weeks).
- **Flexible Work / Remote Arrangements:** Securing guaranteed work-from-home days in your formal contract letter.
- **Professional Development Budget:** An allocated annual allowance (e.g. $3,000–$5,000) for certifications, conferences, and executive coaching.
- **Accelerated 6-Month Review:** A contractual clause stipulating a formal performance and salary review at 6 months rather than the standard 12 months.
`,
  },
  {
    slug: "write-an-australian-cover-letter-that-gets-read",
    title: "How to Write an Australian Cover Letter That Actually Gets Read by Recruiters",
    subtitle: "Why 80% of cover letters get thrown away, and the exact 3-paragraph structure Australian hiring managers love to see.",
    metaDescription: "Step-by-step guide to writing a high-converting Australian cover letter. Includes proven 3-paragraph template, real SEEK application examples, and formatting rules.",
    publishedAt: "2026-08-24",
    updatedAt: "2026-08-26",
    readingTimeMinutes: 5,
    category: "resumes",
    categoryLabel: "Resumes & Formatting",
    tags: ["Cover Letter", "Job Applications", "Australia", "SEEK", "Templates"],
    featured: false,
    author: BLOG_AUTHORS.lachlan,
    targetAudience: "Australian job hunters seeking a concise, punchy cover letter template that grabs attention without wasting time.",
    keyTakeaways: [
      "Australian cover letters should be strictly 3 to 4 paragraphs on a single A4 page (250–350 words).",
      "Do NOT simply rehash your resume chronologically; connect your specific skills directly to the employer's current problems.",
      "Address the letter to a named person whenever possible (use LinkedIn to find the Talent Acquisition Manager).",
      "Include a compelling hook in paragraph 1 that demonstrates real knowledge of the company's recent news or mission.",
      "Always sign off with a clear, proactive call to action.",
    ],
    tableOfContents: [
      { id: "do-australian-recruiters-read-cover-letters", title: "1. Do Recruiters in Australia Still Read Cover Letters?", level: 2 },
      { id: "the-3-paragraph-framework", title: "2. The Proven 3-Paragraph Structure", level: 2 },
      { id: "full-template-example", title: "3. Copy-and-Paste Australian Cover Letter Template", level: 2 },
      { id: "common-cover-letter-pitfalls", title: "4. What NOT to Write", level: 2 },
    ],
    content: `
There is an ongoing debate in the recruitment industry: *Do hiring managers in Australia actually read cover letters?*

The realistic answer: **Australian recruiters only read cover letters when they are short, tailored, and immediately address the company's specific business pain points.**

Generic, templated cover letters that regurgitate your resume are deleted in 3 seconds. But a sharp, 250-word targeted letter can be the exact differentiator that tips an interview decision in your favor when 150 candidates apply for the same SEEK listing.

---

## 1. Do Recruiters in Australia Still Read Cover Letters?

In Australia:
- **Private Sector / Tech / Startups:** A cover letter is optional unless specified, but when well-written, it proves culture fit and communication capability.
- **Government / Higher Education / Healthcare / Non-Profit:** A tailored cover letter or Statement of Claims is **strictly mandatory**.

The golden rule for Australian cover letters: **Keep it under 350 words on a single A4 page.**

---

## 2. The Proven 3-Paragraph Structure

### Paragraph 1: The Hook & Position (50–70 words)
- State the exact position you are applying for and where you found it (e.g. SEEK, LinkedIn).
- Mention a compelling reason why you are drawn to the company's specific mission, product release, or market expansion.
- Summarize your 1-sentence value proposition.

### Paragraph 2: The Direct Fit & Metrics (120–160 words)
- Highlight 2 specific achievements from your past roles that directly solve the primary challenges listed in their job description.
- Use concrete numbers, percentages, or dollar amounts.
- Explain *how* your approach will translate to immediate impact in their team.

### Paragraph 3: The Closing & Next Steps (50–70 words)
- Reiterate your enthusiasm for the role.
- Confirm your availability for an interview and Australian working rights.
- Close with a polite, professional call to action.

---

## 3. Copy-and-Paste Australian Cover Letter Template

Here is a ready-to-adapt template formatted for Australian standards:

\`\`\`markdown
[Your Full Name]
[Phone Number: +61 4xx xxx xxx] | [Email Address] | [LinkedIn Profile URL]
[City, State, Australia] | Full Australian Working Rights

[Date: e.g. 24 August 2026]

Hiring Team / [Hiring Manager Name if known]
[Company Name]
[Company Address or City, State]

RE: Application for [Exact Role Title] (Job Ref: #[Job ID if applicable])

Dear [Hiring Manager Name or "Hiring Team at Company Name"],

I am writing to express my enthusiastic interest in the [Role Title] position advertised on [SEEK / LinkedIn]. Having followed [Company Name]'s recent expansion into [Specific Industry Domain / Product Launch], I was immediately drawn to your team's commitment to [Specific Company Value or Initiative]. With over [X years] of experience scaling [Core Function / Discipline] across fast-paced Australian environments, I am eager to bring my expertise to your team.

In my recent role as [Previous Role Title] at [Previous Company], I led [Key Project Name], where I was responsible for [Brief Scope of Responsibility]. By implementing [Specific Strategy or Technical Tool], I delivered [Quantifiable Result: e.g. a 34% increase in user engagement and $250k in cost savings over 6 months]. In addition, my hands-on background with [Tool 1, Tool 2, and Methodology] aligns seamlessly with the requirements outlined in your job specification.

I would welcome the opportunity to discuss how my skill set and enthusiasm for [Company Name]'s mission can contribute to your upcoming FY27 roadmap. Thank you for your time and consideration.

Yours sincerely,

[Your Name]
\`\`\`

---

## 4. What NOT to Write

1. **"To Whom It May Concern":** It feels cold and automated. If you cannot locate the hiring manager's name on LinkedIn, use *"Dear Hiring Team at [Company Name]"*.
2. **"I am the ideal candidate because I need this job":** Focus entirely on the employer's needs and how you add value, not on your personal career desires.
3. **Copying and Pasting Entire Resume Bullet Points:** A cover letter should tell the cohesive narrative behind your achievements, not duplicate your resume word for word.
4. **Using American Spelling:** Ensure spellcheck is configured for Australian English (\`organisation\`, not \`organization\`).
`,
  },
];

// Helper query functions
export function getAllPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function getFeaturedPost(): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.featured) || BLOG_POSTS[0];
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function getPostsByCategory(category: string): BlogPost[] {
  if (category === "all") {
    return getAllPosts();
  }
  return getAllPosts().filter((post) => post.category === category);
}

export function getRelatedPosts(currentSlug: string, limit: number = 3): BlogPost[] {
  const current = getPostBySlug(currentSlug);
  if (!current) return [];

  const others = getAllPosts().filter((p) => p.slug !== currentSlug);
  const sameCategory = others.filter((p) => p.category === current.category);
  const differentCategory = others.filter((p) => p.category !== current.category);

  return [...sameCategory, ...differentCategory].slice(0, limit);
}

export function getAllCategories(): BlogCategoryMeta[] {
  return BLOG_CATEGORIES;
}

export function searchPosts(query: string): BlogPost[] {
  const q = query.toLowerCase().trim();
  if (!q) return getAllPosts();

  return getAllPosts().filter((post) => {
    return (
      post.title.toLowerCase().includes(q) ||
      post.subtitle.toLowerCase().includes(q) ||
      post.metaDescription.toLowerCase().includes(q) ||
      post.tags.some((tag) => tag.toLowerCase().includes(q)) ||
      post.categoryLabel.toLowerCase().includes(q) ||
      post.author.name.toLowerCase().includes(q)
    );
  });
}
