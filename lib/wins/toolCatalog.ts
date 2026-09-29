/**
 * Common tools, software and systems across industries, used to suggest completions as a
 * candidate types into a tools picker - so they don't have to spell out (or misspell) the full
 * name. Suggestions only: anything not in here can still be added as typed.
 */
export const TOOL_CATALOG: readonly string[] = [
  // Office & productivity
  "Microsoft Excel", "Microsoft Word", "Microsoft PowerPoint", "Microsoft Outlook", "Microsoft Teams",
  "Microsoft Access", "Microsoft Project", "Microsoft Visio", "SharePoint", "OneDrive", "Microsoft 365",
  "Google Sheets", "Google Docs", "Google Slides", "Google Drive", "Google Workspace", "Gmail",
  "Slack", "Zoom", "Notion", "Confluence", "Dropbox", "Box", "Adobe Acrobat", "DocuSign", "Calendly",
  // Project & work management
  "Jira", "Asana", "Trello", "Monday.com", "ClickUp", "Smartsheet", "Basecamp", "Wrike", "Airtable",
  "Miro", "Lucidchart", "Linear",
  // Data & analytics
  "SQL", "Snowflake", "Snowpark", "Snowsight", "BigQuery", "Amazon Redshift", "Databricks", "dbt",
  "Apache Spark", "Apache Airflow", "Apache Kafka", "Hadoop", "Fivetran", "Talend", "Informatica",
  "Alteryx", "Tableau", "Power BI", "Looker", "Looker Studio", "Qlik", "Metabase", "Mode", "SAS", "SPSS",
  "Stata", "R", "Python", "pandas", "NumPy", "Jupyter", "Microsoft SQL Server", "PostgreSQL", "MySQL",
  "Oracle Database", "MongoDB", "Redis", "Elasticsearch", "Google Analytics", "Adobe Analytics",
  "Mixpanel", "Amplitude", "Segment",
  // Software & engineering
  "JavaScript", "TypeScript", "Java", "C#", "C++", "Go", "Rust", "PHP", "Ruby", "Swift", "Kotlin",
  "React", "Next.js", "Angular", "Vue.js", "Node.js", ".NET", "Django", "Flask", "Spring Boot",
  "Ruby on Rails", "HTML", "CSS", "Tailwind CSS", "GraphQL", "REST APIs", "Git", "GitHub", "GitLab",
  "Bitbucket", "Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "GitHub Actions", "CircleCI",
  "Postman", "Selenium", "Cypress", "Playwright", "Visual Studio Code", "Linux", "Bash", "PowerShell",
  // Cloud & IT
  "AWS", "Microsoft Azure", "Google Cloud (GCP)", "Vercel", "Supabase", "Firebase", "Heroku",
  "ServiceNow", "Zendesk", "Freshdesk", "Active Directory", "Okta", "VMware", "Windows Server",
  "Cisco", "Datadog", "Splunk", "New Relic", "PagerDuty",
  // AI
  "ChatGPT", "Claude", "Microsoft Copilot", "GitHub Copilot", "OpenAI API", "TensorFlow", "PyTorch",
  "scikit-learn", "Hugging Face",
  // Design & creative
  "Figma", "Sketch", "Adobe XD", "Adobe Photoshop", "Adobe Illustrator", "Adobe InDesign",
  "Adobe Premiere Pro", "Adobe After Effects", "Adobe Lightroom", "Canva", "Final Cut Pro",
  "DaVinci Resolve", "Blender", "AutoCAD", "Revit", "SketchUp", "SolidWorks", "Rhino",
  // Marketing & content
  "HubSpot", "Mailchimp", "Klaviyo", "Marketo", "Pardot", "Hootsuite", "Buffer", "Sprout Social",
  "Meta Business Suite", "Google Ads", "Meta Ads Manager", "LinkedIn Ads", "SEMrush", "Ahrefs",
  "Google Search Console", "Google Tag Manager", "WordPress", "Webflow", "Wix", "Squarespace",
  "Shopify", "WooCommerce", "Magento", "BigCommerce", "Hotjar",
  // Sales & CRM
  "Salesforce", "Salesforce Marketing Cloud", "Microsoft Dynamics 365", "Pipedrive", "Zoho CRM",
  "LinkedIn Sales Navigator", "Outreach", "Salesloft", "Gong", "Apollo.io", "Intercom",
  // Finance & accounting
  "Xero", "MYOB", "QuickBooks", "Sage", "NetSuite", "SAP", "SAP S/4HANA", "Oracle Financials",
  "Oracle E-Business Suite", "Workday Financials", "Bloomberg Terminal", "FactSet", "Capital IQ",
  "Refinitiv Eikon", "Stripe", "PayPal", "Square", "Expensify", "Concur", "Dext", "Hubdoc",
  "Adobe Sign", "Anaplan", "Power Query", "Excel VBA", "Pivot Tables",
  // HR & payroll
  "Workday", "BambooHR", "Employment Hero", "ADP", "SuccessFactors", "Oracle HCM", "Deputy",
  "Tanda", "KeyPay", "Greenhouse", "Lever", "SEEK Talent Search", "LinkedIn Recruiter", "Rippling",
  "Gusto", "Culture Amp", "Lattice",
  // Retail, hospitality & POS
  "POS system", "Square POS", "Lightspeed", "Vend", "Shopify POS", "Clover", "Toast", "Micros",
  "Oracle Opera", "Cloudbeds", "SevenRooms", "OpenTable", "ResDiary", "Kounta", "Impos",
  "Inventory management system", "Cash handling", "EFTPOS", "Barcode scanner", "Stocktake software",
  // Logistics, supply chain & operations
  "SAP ERP", "Oracle SCM", "Manhattan WMS", "Blue Yonder", "CartonCloud", "ShipStation",
  "Warehouse management system (WMS)", "Transport management system (TMS)", "RF scanner", "Forklift",
  "MYOB Advanced", "Odoo", "Cin7", "Unleashed", "Fleet management software",
  // Healthcare & community
  "Epic", "Cerner", "Best Practice", "Medical Director", "HealthEngine", "Cliniko", "HotDoc",
  "Electronic medical records (EMR)", "My Health Record", "MedicationCare", "Carelink", "Lumary",
  "SupportAbility", "ShiftCare",
  // Education
  "Canvas LMS", "Moodle", "Blackboard", "Google Classroom", "Seesaw", "Compass", "SEQTA",
  "Microsoft OneNote", "Kahoot!", "Articulate Storyline", "Articulate Rise",
  // Construction, trades & engineering
  "Procore", "Aconex", "Buildertrend", "Bluebeam", "MATLAB", "ANSYS", "ArcGIS", "QGIS", "Primavera P6",
  "Navisworks", "Civil 3D", "ServiceM8", "simPRO", "Tradify", "AroFlo",
  // Legal & government
  "LEAP", "Actionstep", "Clio", "LexisNexis", "Westlaw", "iManage", "TRIM (Content Manager)",
  // Customer service & communications
  "Genesys", "Five9", "Aircall", "Twilio", "LiveChat", "Freshworks", "Help Scout", "Gorgias",
];
