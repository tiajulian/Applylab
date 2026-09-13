import puppeteer from "puppeteer";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, "../public/templates");

const TEMPLATES = [
  {
    id: "clean",
    title: "Clean",
    subtitle: "Most popular",
    html: `<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 794px; height: 1123px; padding: 48px 52px;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    color: #171717; background: #ffffff; line-height: 1.45;
  }
  .header { border-bottom: 2px solid #EA580C; padding-bottom: 14px; margin-bottom: 20px; }
  .name { font-size: 26px; font-weight: 800; color: #171717; letter-spacing: -0.02em; }
  .role { font-size: 14px; font-weight: 700; color: #EA580C; margin-top: 2px; }
  .meta { font-size: 11px; color: #6B7280; margin-top: 6px; display: flex; gap: 12px; }
  .sec-title {
    font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
    color: #EA580C; margin: 18px 0 8px; display: flex; align-items: center; gap: 8px;
  }
  .sec-title::after { content: ""; flex: 1; height: 1px; background: #FED7AA; }
  .summary { font-size: 11.5px; color: #374151; line-height: 1.5; }
  .job { margin-bottom: 14px; }
  .job-head { display: flex; justify-content: space-between; align-items: baseline; }
  .job-title { font-size: 13px; font-weight: 700; color: #111827; }
  .job-date { font-size: 11px; font-weight: 600; color: #6B7280; }
  .job-co { font-size: 11.5px; font-weight: 600; color: #4B5563; margin-bottom: 4px; }
  ul { padding-left: 16px; font-size: 11px; color: #374151; }
  li { margin-bottom: 4px; line-height: 1.45; }
  .skills-grid { display: flex; flex-wrap: wrap; gap: 6px; }
  .skill-badge {
    font-size: 10.5px; font-weight: 600; background: #FFF7ED; color: #C2410C;
    border: 1px solid #FFEDD5; padding: 3px 9px; border-radius: 999px;
  }
  .edu-row { display: flex; justify-content: space-between; font-size: 11.5px; }
  .edu-deg { font-weight: 700; color: #111827; }
  .edu-sub { color: #6B7280; font-size: 11px; }
</style>
</head>
<body>
  <div class="header">
    <div class="name">Alex Wright</div>
    <div class="role">Senior Product Operations Manager</div>
    <div class="meta">
      <span>Melbourne VIC</span> · <span>0412 884 921</span> · <span>alex.wright@applylab.au</span> · <span>Full AU Work Rights</span>
    </div>
  </div>

  <div class="sec-title">Professional Summary</div>
  <p class="summary">Product operations lead with 6+ years streamlining SaaS delivery across cross-functional teams in Melbourne. Proven track record scaling release cadence by 40% and integrating automated customer feedback telemetry into product backlogs.</p>

  <div class="sec-title">Work Experience</div>
  <div class="job">
    <div class="job-head">
      <span class="job-title">Lead Product Operations Specialist</span>
      <span class="job-date">2022 – Present</span>
    </div>
    <div class="job-co">Envato · Melbourne, Australia</div>
    <ul>
      <li>Architected end-to-end product delivery rhythms for 4 engineering squads, reducing cycle times by 32%.</li>
      <li>Spearheaded rollout of continuous feature-flag telemetry in Jira & Amplitude, cutting release defects by 24%.</li>
      <li>Standardised weekly stakeholder briefing templates used by executive leadership across 12 product lines.</li>
    </ul>
  </div>

  <div class="job">
    <div class="job-head">
      <span class="job-title">Senior Operations Associate</span>
      <span class="job-date">2019 – 2022</span>
    </div>
    <div class="job-co">REA Group · Richmond VIC</div>
    <ul>
      <li>Coordinated cross-functional launch operations for 6 major commercial listing feature updates.</li>
      <li>Designed automated reporting pipelines with SQL & Tableau, eliminating 8 hours of manual weekly reporting.</li>
      <li>Trained 35+ onboarding product managers and designers in agile product lifecycle protocols.</li>
    </ul>
  </div>

  <div class="sec-title">Education &amp; Credentials</div>
  <div class="edu-row">
    <div><span class="edu-deg">Bachelor of Commerce (Management & Marketing)</span> · <span class="edu-sub">University of Melbourne</span></div>
    <span class="job-date">2016 – 2019</span>
  </div>

  <div class="sec-title" style="margin-top:16px;">Core Competencies</div>
  <div class="skills-grid">
    <span class="skill-badge">Product Lifecycle Management</span>
    <span class="skill-badge">Cross-Functional Leadership</span>
    <span class="skill-badge">Jira &amp; Confluence Ops</span>
    <span class="skill-badge">SQL &amp; Amplitude Telemetry</span>
    <span class="skill-badge">Stakeholder Alignment</span>
    <span class="skill-badge">Agile &amp; Scrum Delivery</span>
    <span class="skill-badge">Process Automation</span>
  </div>
</body>
</html>`
  },
  {
    id: "classic",
    title: "Classic",
    subtitle: "Traditional",
    html: `<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 794px; height: 1123px; padding: 48px 52px;
    font-family: 'Plus Jakarta Sans', Georgia, serif;
    color: #1F2937; background: #ffffff; line-height: 1.45;
  }
  .header { text-align: center; border-bottom: 1.5px solid #111827; padding-bottom: 14px; margin-bottom: 18px; }
  .name { font-size: 24px; font-weight: 800; color: #111827; letter-spacing: -0.01em; }
  .role { font-size: 13px; font-weight: 600; color: #4B5563; margin-top: 3px; font-style: italic; }
  .meta { font-size: 10.5px; color: #4B5563; margin-top: 6px; font-style: normal; }
  .sec-title {
    font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;
    color: #111827; border-bottom: 1px solid #D1D5DB; padding-bottom: 3px; margin: 16px 0 8px;
  }
  .summary { font-size: 11px; color: #374151; line-height: 1.5; }
  .job { margin-bottom: 14px; }
  .job-head { display: flex; justify-content: space-between; }
  .job-title { font-size: 12.5px; font-weight: 700; color: #111827; }
  .job-date { font-size: 11px; font-weight: 600; color: #4B5563; }
  .job-co { font-size: 11.5px; font-style: italic; color: #374151; margin-bottom: 4px; }
  ul { padding-left: 16px; font-size: 11px; color: #374151; }
  li { margin-bottom: 4px; line-height: 1.45; }
  .skills-list { font-size: 11px; color: #374151; line-height: 1.6; }
</style>
</head>
<body>
  <div class="header">
    <div class="name">David Chen</div>
    <div class="role">Senior Financial Analyst &amp; Modelling Specialist</div>
    <div class="meta">Sydney NSW · 0421 993 112 · david.chen@applylab.au · Australian Citizen</div>
  </div>

  <div class="sec-title">Executive Summary</div>
  <p class="summary">CFA Charterholder with 7+ years of rigorous financial modelling, valuation, and capital allocation experience within ASX-listed financial institutions and top-tier Australian advisory firms. Expert in corporate forecast modelling, M&A due diligence, and capital budgeting.</p>

  <div class="sec-title">Professional Experience</div>
  <div class="job">
    <div class="job-head">
      <span class="job-title">Senior Financial Analyst — Corporate Finance</span>
      <span class="job-date">2021 – Present</span>
    </div>
    <div class="job-co">Macquarie Group · Sydney, Australia</div>
    <ul>
      <li>Constructed comprehensive 3-statement forecast models for $450M+ infrastructure acquisitions across ANZ.</li>
      <li>Formulated quarterly valuation models and variance analyses presented directly to executive committees.</li>
      <li>Automated data ingestion from Bloomberg and S&P Capital IQ using Python & Power Query, saving 15 analyst hours/week.</li>
    </ul>
  </div>

  <div class="job">
    <div class="job-head">
      <span class="job-title">Valuations &amp; Modelling Analyst</span>
      <span class="job-date">2018 – 2021</span>
    </div>
    <div class="job-co">KPMG Australia · Barangaroo NSW</div>
    <ul>
      <li>Delivered DCF, comparable company, and transaction multiple valuations for mid-market transaction targets.</li>
      <li>Conducted rigorous financial due diligence across 18 completed Australian commercial transactions.</li>
      <li>Authored formal valuation reports compliant with APES 225 standards for ATO submission and audit defense.</li>
    </ul>
  </div>

  <div class="sec-title">Education &amp; Qualifications</div>
  <div class="job-head">
    <span class="job-title">Bachelor of Commerce (Accounting &amp; Finance)</span>
    <span class="job-date">2015 – 2018</span>
  </div>
  <div class="job-co">University of New South Wales (UNSW) · Distinction Average</div>
  <p style="font-size: 11px; color: #374151; margin-top: 3px;"><strong>CFA Charterholder</strong> (CFA Institute) · Active Member of CFA Society Sydney</p>

  <div class="sec-title">Core Competencies &amp; Technical Skills</div>
  <p class="skills-list"><strong>Financial Modelling:</strong> 3-Statement Forecasting, DCF Valuation, LBO Models, Scenario &amp; Sensitivity Analysis<br>
  <strong>Software &amp; Tools:</strong> Advanced Excel (VBA/Power Query), Python (Pandas), Bloomberg Terminal, Tableau, Xero<br>
  <strong>Regulatory &amp; Reporting:</strong> AASB Standards, APES 225, Board Pack Preparation, Statutory Compliance</p>
</body>
</html>`
  },
  {
    id: "modern",
    title: "Modern",
    subtitle: "Design-forward",
    html: `<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 794px; height: 1123px;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    color: #171717; background: #ffffff; line-height: 1.45;
  }
  .band {
    background: linear-gradient(135deg, #EA580C, #F97316);
    padding: 36px 48px 30px; color: #ffffff;
  }
  .band .name { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
  .band .role { font-size: 14px; font-weight: 600; opacity: 0.95; margin-top: 3px; }
  .band .meta { font-size: 11px; opacity: 0.85; margin-top: 8px; display: flex; gap: 14px; }
  .content { padding: 32px 48px; }
  .sec-title {
    font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
    color: #EA580C; margin: 16px 0 8px;
  }
  .summary { font-size: 11.5px; color: #374151; line-height: 1.5; }
  .job { margin-bottom: 14px; }
  .job-head { display: flex; justify-content: space-between; align-items: baseline; }
  .job-title { font-size: 13px; font-weight: 700; color: #111827; }
  .job-date { font-size: 11px; font-weight: 600; color: #6B7280; }
  .job-co { font-size: 11.5px; font-weight: 600; color: #EA580C; margin-bottom: 4px; }
  ul { padding-left: 16px; font-size: 11px; color: #374151; }
  li { margin-bottom: 4px; line-height: 1.45; }
  .pill-group { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill { font-size: 10.5px; font-weight: 600; background: #FFF7ED; color: #C2410C; padding: 4px 10px; border-radius: 6px; }
</style>
</head>
<body>
  <div class="band">
    <div class="name">Priya Nair</div>
    <div class="role">Implementation Analyst &amp; Operations Specialist</div>
    <div class="meta">
      <span>Cremorne VIC</span> · <span>0419 772 334</span> · <span>priya.nair@applylab.au</span> · <span>Full AU Work Rights</span>
    </div>
  </div>

  <div class="content">
    <div class="sec-title">Profile</div>
    <p class="summary">Systems & workflow implementation specialist with 5+ years optimizing ERP rollouts, POS integrations, and operational protocols across Melbourne multi-site hospitality and commercial networks. Proven record cutting onboarding cycle times by 30%.</p>

    <div class="sec-title">Experience</div>
    <div class="job">
      <div class="job-head">
        <span class="job-title">Implementation Specialist</span>
        <span class="job-date">2022 – Present</span>
      </div>
      <div class="job-co">Deputy Software · Melbourne VIC</div>
      <ul>
        <li>Configured and deployed automated rostering and time-tracking integrations for 45+ Australian enterprise venues.</li>
        <li>Conducted user training workshops and system audits, boosting client adoption velocity by 28% within 60 days.</li>
        <li>Collaborated with product engineers to resolve API payload discrepancies between POS and payroll engines.</li>
      </ul>
    </div>

    <div class="job">
      <div class="job-head">
        <span class="job-title">Operations &amp; Venue Manager</span>
        <span class="job-date">2019 – 2022</span>
      </div>
      <div class="job-co">Marlowe Hospitality Group · Melbourne VIC</div>
      <ul>
        <li>Led comprehensive POS, inventory, and shift-management system migrations across 3 flagship Melbourne venues.</li>
        <li>Managed 18 direct reports, instigating operational SLAs that curtailed inventory shrinkage by 14%.</li>
        <li>Maintained 100% compliance with Victorian Fair Work and responsible service legislation.</li>
      </ul>
    </div>

    <div class="sec-title">Education</div>
    <div class="job-head">
      <span class="job-title">Bachelor of Business Information Systems</span>
      <span class="job-date">2016 – 2019</span>
    </div>
    <div style="font-size:11.5px; color:#4B5563;">RMIT University · Melbourne Australia</div>

    <div class="sec-title" style="margin-top:16px;">Core Expertise</div>
    <div class="pill-group">
      <span class="pill">Systems Implementation</span>
      <span class="pill">ERP / POS Rollouts</span>
      <span class="pill">Client Change Management</span>
      <span class="pill">Workflow Analysis</span>
      <span class="pill">API &amp; Data Verification</span>
      <span class="pill">Fair Work Compliance</span>
      <span class="pill">SQL &amp; Reporting</span>
    </div>
  </div>
</body>
</html>`
  },
  {
    id: "compact",
    title: "Compact",
    subtitle: "Dense",
    html: `<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 794px; height: 1123px; padding: 36px 44px;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    color: #171717; background: #ffffff; line-height: 1.35;
  }
  .header { border-bottom: 1.5px solid #E5E7EB; padding-bottom: 10px; margin-bottom: 12px; }
  .name { font-size: 22px; font-weight: 800; color: #111827; }
  .role { font-size: 13px; font-weight: 700; color: #EA580C; }
  .meta { font-size: 10.5px; color: #6B7280; margin-top: 3px; display: flex; gap: 10px; }
  .sec-title {
    font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
    color: #EA580C; margin: 10px 0 5px; border-bottom: 1px solid #FFEDD5; padding-bottom: 2px;
  }
  .job { margin-bottom: 9px; }
  .job-head { display: flex; justify-content: space-between; }
  .job-title { font-size: 12px; font-weight: 700; color: #111827; }
  .job-date { font-size: 10.5px; font-weight: 600; color: #6B7280; }
  .job-co { font-size: 11px; font-weight: 600; color: #4B5563; margin-bottom: 2px; }
  ul { padding-left: 15px; font-size: 10.5px; color: #374151; }
  li { margin-bottom: 2px; }
  .skills-box { font-size: 10.5px; color: #374151; line-height: 1.45; }
</style>
</head>
<body>
  <div class="header">
    <div class="name">Sam Taylor</div>
    <div class="role">Operations &amp; Supply Chain Lead</div>
    <div class="meta">
      <span>Brisbane QLD</span> · <span>0403 661 889</span> · <span>sam.taylor@applylab.au</span> · <span>Australian Citizen</span>
    </div>
  </div>

  <div class="sec-title">Summary</div>
  <p style="font-size:10.5px; color:#374151;">Results-focused operations lead with 8+ years optimizing multi-site freight networks, procurement, and warehouse workflows across Queensland. Expert in reducing fulfillment costs while maintaining >99.4% on-time delivery SLAs.</p>

  <div class="sec-title">Work Experience</div>
  <div class="job">
    <div class="job-head">
      <span class="job-title">Operations &amp; Logistics Lead</span>
      <span class="job-date">2022 – Present</span>
    </div>
    <div class="job-co">Toll Group · Brisbane Distribution Hub, QLD</div>
    <ul>
      <li>Oversee daily freight operations across 4 Queensland transit terminals with 65+ logistics personnel.</li>
      <li>Lowered fuel and route variance costs by $240K annually through dynamic GPS dispatch routing implementation.</li>
      <li>Implemented Lean 5S warehouse protocols, boosting pick-and-pack fulfillment rates by 22%.</li>
    </ul>
  </div>

  <div class="job">
    <div class="job-head">
      <span class="job-title">Senior Supply Chain Coordinator</span>
      <span class="job-date">2019 – 2022</span>
    </div>
    <div class="job-co">Super Retail Group · Strathpine QLD</div>
    <ul>
      <li>Managed vendor performance SLAs for 28 tier-1 Australian suppliers, achieving 98.7% DIFOT compliance.</li>
      <li>Automated weekly purchase order reconciliations with SAP MM and Excel VBA scripts.</li>
      <li>Spearheaded safety compliance program that maintained 730 consecutive zero-LTI operating days.</li>
    </ul>
  </div>

  <div class="job">
    <div class="job-head">
      <span class="job-title">Logistics Analyst</span>
      <span class="job-date">2016 – 2019</span>
    </div>
    <div class="job-co">Aurizon · Brisbane QLD</div>
    <ul>
      <li>Modeled bulk freight transit capacities and tracked network dwell times using SQL & Tableau.</li>
      <li>Prepared monthly performance scorecards for executive freight review meetings.</li>
    </ul>
  </div>

  <div class="sec-title">Education &amp; Credentials</div>
  <div class="job-head">
    <span class="job-title">Bachelor of Business (Logistics &amp; Supply Chain)</span>
    <span class="job-date">2013 – 2016</span>
  </div>
  <div style="font-size:10.5px; color:#4B5563;">Queensland University of Technology (QUT)</div>
  <p style="font-size:10.5px; color:#374151; margin-top:2px;"><strong>Certifications:</strong> Six Sigma Green Belt · APICS Certified Supply Chain Professional (CSCP)</p>

  <div class="sec-title">Skills &amp; Technologies</div>
  <p class="skills-box">
    <strong>Systems:</strong> SAP MM/WM, Manhattan WMS, Oracle NetSuite, Tableau, Advanced Excel<br>
    <strong>Domain:</strong> Freight Route Optimization, Vendor Management, Inventory Budgeting, Lean 5S, WHS Compliance
  </p>
</body>
</html>`
  },
  {
    id: "editorial",
    title: "Editorial",
    subtitle: "Executive",
    html: `<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 794px; height: 1123px;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    color: #171717; background: #ffffff; line-height: 1.5;
  }
  .band {
    background: #18181B;
    padding: 38px 48px 28px; color: #ffffff;
  }
  .band .name { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
  .band .role { font-size: 13.5px; font-weight: 500; color: #E4E4E7; margin-top: 3px; }
  .band .meta { font-size: 11px; color: #A1A1AA; margin-top: 8px; display: flex; gap: 14px; }
  .content { padding: 34px 48px; }
  .sec-title {
    font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em;
    color: #18181B; border-bottom: 1.5px solid #18181B; padding-bottom: 4px; margin: 18px 0 10px;
  }
  .summary { font-size: 11.5px; color: #374151; line-height: 1.55; }
  .job { margin-bottom: 15px; }
  .job-head { display: flex; justify-content: space-between; align-items: baseline; }
  .job-title { font-size: 13px; font-weight: 700; color: #111827; }
  .job-date { font-size: 11px; font-weight: 600; color: #6B7280; }
  .job-co { font-size: 11.5px; font-weight: 600; color: #71717A; margin-bottom: 4px; }
  ul { padding-left: 16px; font-size: 11px; color: #374151; }
  li { margin-bottom: 4px; line-height: 1.45; }
  .skills-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .skill-item { font-size: 10.5px; font-weight: 600; background: #F4F4F5; color: #27272A; padding: 4px 10px; border-radius: 4px; }
</style>
</head>
<body>
  <div class="band">
    <div class="name">Grace Miller</div>
    <div class="role">Marketing &amp; Brand Strategy Director</div>
    <div class="meta">
      <span>Sydney NSW</span> · <span>0488 221 445</span> · <span>grace.miller@applylab.au</span> · <span>Australian Citizen</span>
    </div>
  </div>

  <div class="content">
    <div class="sec-title">Executive Profile</div>
    <p class="summary">Award-winning brand director with 10+ years shaping high-growth B2B and consumer brands across Australia and the UK. Proven track record expanding national market share, scaling multi-million dollar omni-channel campaigns, and leading high-performing creative teams.</p>

    <div class="sec-title">Leadership Experience</div>
    <div class="job">
      <div class="job-head">
        <span class="job-title">Head of Brand &amp; Content Strategy</span>
        <span class="job-date">2021 – Present</span>
      </div>
      <div class="job-co">Canva Australia · Sydney NSW</div>
      <ul>
        <li>Spearheaded international brand campaigns driving a 42% lift in Enterprise ARR pipeline attribution.</li>
        <li>Directed a 14-person multidisciplinary team across brand marketing, content production, and PR.</li>
        <li>Re-engineered brand governance frameworks across 180+ global product templates and external assets.</li>
      </ul>
    </div>

    <div class="job">
      <div class="job-head">
        <span class="job-title">Senior Brand Marketing Manager</span>
        <span class="job-date">2017 – 2021</span>
      </div>
      <div class="job-co">Domain Group · Pyrmont NSW</div>
      <ul>
        <li>Executed national consumer awareness campaigns spanning TV, digital out-of-home, and performance media.</li>
        <li>Collaborated with product teams on consumer app rebranding, resulting in a 24% uplift in weekly active users.</li>
        <li>Managed an annual paid media and production budget of $4.8M with 100% budget adherence.</li>
      </ul>
    </div>

    <div class="sec-title">Education &amp; Credentials</div>
    <div class="job-head">
      <span class="job-title">Master of Marketing Communications</span>
      <span class="job-date">2014 – 2016</span>
    </div>
    <div style="font-size:11px; color:#71717A;">University of Sydney · First Class Honours</div>

    <div class="sec-title" style="margin-top:16px;">Strategic Competencies</div>
    <div class="skills-row">
      <span class="skill-item">Brand Architecture &amp; Positioning</span>
      <span class="skill-item">Enterprise Campaign Strategy</span>
      <span class="skill-item">Omni-Channel Media Planning</span>
      <span class="skill-item">Creative Team Leadership</span>
      <span class="skill-item">Market Research &amp; Segmentation</span>
      <span class="skill-item">Budget Allocation &amp; ROI Modeling</span>
    </div>
  </div>
</body>
</html>`
  },
  {
    id: "technical",
    title: "Technical",
    subtitle: "Skills-first",
    html: `<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 794px; height: 1123px; display: flex;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    color: #171717; background: #ffffff; line-height: 1.4;
  }
  .sidebar {
    width: 250px; background: #FFF7ED; padding: 40px 24px; border-right: 1px solid #FFEDD5;
  }
  .main {
    flex: 1; padding: 40px 32px;
  }
  .side-title {
    font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
    color: #EA580C; margin: 18px 0 6px;
  }
  .side-text { font-size: 10.5px; color: #374151; line-height: 1.45; }
  .side-badge {
    display: inline-block; font-size: 9.5px; font-weight: 700; background: #ffffff;
    color: #C2410C; border: 1px solid #FED7AA; padding: 2px 7px; border-radius: 4px; margin: 2px 2px 2px 0;
  }
  .name { font-size: 24px; font-weight: 800; color: #111827; }
  .role { font-size: 13.5px; font-weight: 700; color: #EA580C; margin-top: 2px; }
  .summary { font-size: 11px; color: #374151; margin-top: 10px; line-height: 1.45; }
  .sec-title {
    font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
    color: #111827; border-bottom: 1.5px solid #EA580C; padding-bottom: 3px; margin: 16px 0 8px;
  }
  .job { margin-bottom: 12px; }
  .job-head { display: flex; justify-content: space-between; }
  .job-title { font-size: 12px; font-weight: 700; color: #111827; }
  .job-date { font-size: 10.5px; font-weight: 600; color: #6B7280; }
  .job-co { font-size: 11px; font-weight: 600; color: #EA580C; margin-bottom: 3px; }
  ul { padding-left: 15px; font-size: 10.5px; color: #374151; }
  li { margin-bottom: 3px; }
</style>
</head>
<body>
  <div class="sidebar">
    <div style="font-size:14px; font-weight:800; color:#111827;">Contact</div>
    <div class="side-text" style="margin-top:6px;">
      Perth WA<br>
      0433 552 119<br>
      liam.nguyen@applylab.au<br>
      github.com/liamng<br>
      AU Citizen
    </div>

    <div class="side-title">Core Languages</div>
    <div>
      <span class="side-badge">TypeScript</span>
      <span class="side-badge">Python</span>
      <span class="side-badge">Go</span>
      <span class="side-badge">SQL</span>
      <span class="side-badge">Rust</span>
    </div>

    <div class="side-title">Frameworks &amp; Web</div>
    <div>
      <span class="side-badge">React</span>
      <span class="side-badge">Next.js</span>
      <span class="side-badge">Node.js</span>
      <span class="side-badge">GraphQL</span>
      <span class="side-badge">TailwindCSS</span>
    </div>

    <div class="side-title">Cloud &amp; DevOps</div>
    <div>
      <span class="side-badge">AWS (ECS/Lambda)</span>
      <span class="side-badge">Docker</span>
      <span class="side-badge">Kubernetes</span>
      <span class="side-badge">Terraform</span>
      <span class="side-badge">PostgreSQL</span>
      <span class="side-badge">Redis</span>
    </div>

    <div class="side-title">Certifications</div>
    <div class="side-text">
      <strong>AWS Certified</strong> Solutions Architect — Associate (2023)
    </div>

    <div class="side-title">Education</div>
    <div class="side-text">
      <strong>B.Sc. Computer Science</strong><br>
      Univ. of Western Australia<br>
      2016 – 2019
    </div>
  </div>

  <div class="main">
    <div class="name">Liam Nguyen</div>
    <div class="role">Lead Full Stack Software Engineer</div>
    <p class="summary">Engineering lead with 6+ years building fault-tolerant distributed web applications, cloud backends, and low-latency microservices across Australian technology scale-ups. Champion of clean architecture and CI/CD automation.</p>

    <div class="sec-title">Work Experience</div>
    <div class="job">
      <div class="job-head">
        <span class="job-title">Senior Software Engineer — Platform</span>
        <span class="job-date">2022 – Present</span>
      </div>
      <div class="job-co">Atlassian · Remote (WA)</div>
      <ul>
        <li>Architected asynchronous event processing pipeline in Go &amp; Kafka handling 18M+ daily webhook events.</li>
        <li>Reduced p99 REST API latency by 45% through Redis caching layers and Postgres query plan optimization.</li>
        <li>Mentored 5 junior and mid-level engineers in TypeScript patterns and automated test coverage.</li>
      </ul>
    </div>

    <div class="job">
      <div class="job-head">
        <span class="job-title">Full Stack Engineer</span>
        <span class="job-date">2019 – 2022</span>
      </div>
      <div class="job-co">SafetyCulture · Sydney / Perth</div>
      <ul>
        <li>Built real-time inspection collaboration features with React, WebSockets, and AWS DynamoDB.</li>
        <li>Implemented automated end-to-end Playwright test suite in GitHub Actions, slashing release cycle from 3 days to 4 hours.</li>
        <li>Refactored legacy monolith endpoints into modular Docker containers deployed to AWS ECS.</li>
      </ul>
    </div>

    <div class="sec-title">Key Projects</div>
    <div class="job">
      <div class="job-title">Open Source: Distributed Job Queue (Go / Redis)</div>
      <p style="font-size:10.5px; color:#374151;">Lightweight background processing engine with retry backoff and concurrency controls. 1.2k+ GitHub stars.</p>
    </div>
  </div>
</body>
</html>`
  },
  {
    id: "executive",
    title: "Executive",
    subtitle: "Leadership",
    html: `<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 794px; height: 1123px;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    color: #171717; background: #ffffff; line-height: 1.45;
  }
  .band {
    background: #0F172A;
    padding: 38px 48px 28px; color: #ffffff;
  }
  .band .name { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
  .band .role { font-size: 13.5px; font-weight: 600; color: #94A3B8; margin-top: 3px; }
  .band .meta { font-size: 11px; color: #94A3B8; margin-top: 8px; display: flex; gap: 14px; }
  .content { padding: 32px 48px; }
  .sec-title {
    font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;
    color: #0F172A; border-bottom: 2px solid #0F172A; padding-bottom: 3px; margin: 16px 0 8px;
  }
  .summary { font-size: 11.5px; color: #374151; line-height: 1.5; }
  .job { margin-bottom: 14px; }
  .job-head { display: flex; justify-content: space-between; align-items: baseline; }
  .job-title { font-size: 13px; font-weight: 700; color: #0F172A; }
  .job-date { font-size: 11px; font-weight: 600; color: #64748B; }
  .job-co { font-size: 11.5px; font-weight: 600; color: #334155; margin-bottom: 4px; }
  ul { padding-left: 16px; font-size: 11px; color: #374151; }
  li { margin-bottom: 4px; line-height: 1.45; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 11px; color: #374151; }
</style>
</head>
<body>
  <div class="band">
    <div class="name">Robert Hughes</div>
    <div class="role">Chief Operating Officer &amp; General Manager</div>
    <div class="meta">
      <span>Melbourne VIC</span> · <span>0411 332 990</span> · <span>robert.hughes@applylab.au</span> · <span>GAICD</span>
    </div>
  </div>

  <div class="content">
    <div class="sec-title">Executive Summary</div>
    <p class="summary">Transformational C-suite executive with 15+ years steering commercial growth, operational excellence, and M&A integration across ASX-listed and private equity portfolio businesses. Accountable for $120M+ P&L management, 250+ person workforces, and multi-state governance.</p>

    <div class="sec-title">Executive Leadership Experience</div>
    <div class="job">
      <div class="job-head">
        <span class="job-title">Chief Operating Officer (COO)</span>
        <span class="job-date">2020 – Present</span>
      </div>
      <div class="job-co">Apex Logistics &amp; Infrastructure · Melbourne VIC</div>
      <ul>
        <li>Deliver operational leadership across 6 Australian state divisions, boosting EBITDA margin from 11.2% to 17.8% over 3 years.</li>
        <li>Directed integration of $42M bolt-on acquisition, capturing $6.5M in operational synergies within 12 months.</li>
        <li>Instituted enterprise risk management framework, reducing lost-time injury frequency rates (LTIFR) by 54%.</li>
      </ul>
    </div>

    <div class="job">
      <div class="job-head">
        <span class="job-title">General Manager — Commercial Operations</span>
        <span class="job-date">2015 – 2020</span>
      </div>
      <div class="job-co">Cleanaway Waste Management · Melbourne VIC</div>
      <ul>
        <li>Accountable for $85M division revenue, managing 180 operational and fleet maintenance personnel.</li>
        <li>Secured 4 major long-term municipal government contracts valued at $110M+ in collective contract value.</li>
        <li>Led enterprise fleet telematics migration, saving $1.8M in annualized fuel consumption and idle times.</li>
      </ul>
    </div>

    <div class="sec-title">Board &amp; Governance Appointments</div>
    <div class="job-head">
      <span class="job-title">Non-Executive Director</span>
      <span class="job-date">2021 – Present</span>
    </div>
    <div class="job-co">Victorian Maritime Trust · Audit &amp; Risk Committee Chair</div>

    <div class="sec-title">Education &amp; Qualifications</div>
    <div class="grid-2">
      <div>
        <strong>Master of Business Administration (MBA)</strong><br>
        Melbourne Business School (Dean's List)
      </div>
      <div>
        <strong>Company Directors Course (GAICD)</strong><br>
        Australian Institute of Company Directors
      </div>
    </div>
  </div>
</body>
</html>`
  },
  {
    id: "minimal",
    title: "Minimal",
    subtitle: "Pure ATS",
    html: `<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 794px; height: 1123px; padding: 48px 56px;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    color: #171717; background: #ffffff; line-height: 1.5;
  }
  .header { margin-bottom: 20px; }
  .name { font-size: 24px; font-weight: 800; color: #111827; letter-spacing: -0.01em; }
  .role { font-size: 13px; font-weight: 600; color: #4B5563; margin-top: 2px; }
  .meta { font-size: 11px; color: #6B7280; margin-top: 4px; display: flex; gap: 12px; }
  .sec-title {
    font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em;
    color: #4B5563; margin: 18px 0 8px;
  }
  .summary { font-size: 11.5px; color: #374151; line-height: 1.5; }
  .job { margin-bottom: 14px; }
  .job-head { display: flex; justify-content: space-between; align-items: baseline; }
  .job-title { font-size: 12.5px; font-weight: 700; color: #111827; }
  .job-date { font-size: 11px; font-weight: 500; color: #6B7280; }
  .job-co { font-size: 11.5px; color: #4B5563; margin-bottom: 4px; }
  ul { padding-left: 16px; font-size: 11px; color: #374151; }
  li { margin-bottom: 4px; line-height: 1.45; }
  .skills-row { font-size: 11px; color: #374151; line-height: 1.5; }
</style>
</head>
<body>
  <div class="header">
    <div class="name">Chloe Adams</div>
    <div class="role">Senior UX Researcher</div>
    <div class="meta">
      <span>Adelaide SA</span> · <span>0422 114 778</span> · <span>chloe.adams@applylab.au</span> · <span>portfolio.au/chloe</span>
    </div>
  </div>

  <div class="sec-title">Summary</div>
  <p class="summary">Senior UX researcher with 6+ years designing and executing qualitative and quantitative research studies for Australian enterprise and mobile platforms. Specialized in usability benchmarking, stakeholder synthesis, and accessibility (WCAG 2.2).</p>

  <div class="sec-title">Experience</div>
  <div class="job">
    <div class="job-head">
      <span class="job-title">Senior UX Researcher</span>
      <span class="job-date">2022 – Present</span>
    </div>
    <div class="job-co">MYOB · Adelaide SA</div>
    <ul>
      <li>Conducted 40+ moderated customer interviews and discovery sessions for small business payroll modernization.</li>
      <li>Defined behavioral UX scorecards in Maze that guided the redesign of the core invoicing flow, reducing task friction by 34%.</li>
      <li>Established accessibility research testing cohort with vision-impaired users to achieve WCAG AA compliance.</li>
    </ul>
  </div>

  <div class="job">
    <div class="job-head">
      <span class="job-title">User Experience Researcher</span>
      <span class="job-date">2019 – 2022</span>
    </div>
    <div class="job-co">Carsales.com.au · Melbourne / Remote</div>
    <ul>
      <li>Managed unmoderated tree-testing and card-sorting studies with 800+ participants to restructure vehicle search filters.</li>
      <li>Synthesized weekly feedback loops with product and engineering leads, resulting in 18 shipped UX optimizations.</li>
      <li>Created research repository in Dovetail to centralize 120+ customer interview transcripts and video highlights.</li>
    </ul>
  </div>

  <div class="sec-title">Education</div>
  <div class="job-head">
    <span class="job-title">Bachelor of Psychological Science &amp; Design</span>
    <span class="job-date">2015 – 2018</span>
  </div>
  <div class="job-co">University of Adelaide</div>

  <div class="sec-title">Methods &amp; Tooling</div>
  <p class="skills-row">
    <strong>Methodologies:</strong> 1-on-1 Usability Testing, Semi-Structured Interviews, Card Sorting, Tree Testing, Journey Mapping, Survey Design<br>
    <strong>Tools:</strong> Dovetail, UserZoom, Maze, Figma, Optimal Workshop, Qualtrics, Miro
  </p>
</body>
</html>`
  }
];

async function main() {
  console.log("Creating output directory:", OUTPUT_DIR);
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  console.log("Launching headless browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"]
  });

  try {
    for (const tmpl of TEMPLATES) {
      console.log(`Rendering template: ${tmpl.id} (${tmpl.title})...`);
      const page = await browser.newPage();
      await page.setViewport({
        width: 794,
        height: 1123,
        deviceScaleFactor: 2
      });

      await page.setContent(tmpl.html, { waitUntil: "networkidle0" });
      await page.evaluateHandle("document.fonts.ready");

      const screenshotBuffer = await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: 794, height: 1123 }
      });
      await page.close();

      // Output 1x WebP (600x849) target < 40KB
      const outputPath1x = path.join(OUTPUT_DIR, `${tmpl.id}.webp`);
      const buffer1x = await sharp(screenshotBuffer)
        .resize(600, 849, { fit: "cover" })
        .webp({ quality: 82, effort: 6 })
        .toBuffer();
      await fs.writeFile(outputPath1x, buffer1x);

      // Output 2x WebP (1200x1697) target < 90KB
      const outputPath2x = path.join(OUTPUT_DIR, `${tmpl.id}@2x.webp`);
      const buffer2x = await sharp(screenshotBuffer)
        .resize(1200, 1697, { fit: "cover" })
        .webp({ quality: 80, effort: 6 })
        .toBuffer();
      await fs.writeFile(outputPath2x, buffer2x);

      console.log(`  ✓ Saved ${tmpl.id}.webp (${(buffer1x.length / 1024).toFixed(1)} KB) and ${tmpl.id}@2x.webp (${(buffer2x.length / 1024).toFixed(1)} KB)`);
    }
    console.log("All 8 templates rendered successfully!");
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error("Error rendering templates:", err);
  process.exit(1);
});
