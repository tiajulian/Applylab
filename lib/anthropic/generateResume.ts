// Calls Gemini, not Claude - kept in lib/anthropic/ (like lib/anthropic/parseJobAd.ts and
// scoreATS.ts before it) so this file's path doesn't churn every caller's import on a provider
// move. See lib/anthropic/models.ts's MODEL_BY_FEATURE["generate-resume"] comment for why.
import { gemini } from "@/lib/gemini/client";
import { resolveResumeModel, MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import { mergeResumeContent, type TailoredResumeFields } from "@/lib/resume/mergeResumeContent";
import { formatDateRange } from "@/lib/resume/formatDateRange";
import { currentAwareEndDate } from "@/lib/profile/parseRoleDate";
import type { EducationEntry, GenerateResumeInput, ResumeContent } from "@/types";

/** Collapses an EducationEntry's start_date/end_date/is_current into the single display string
 * the prompt and the generated resume's `year` field both use - same "Current" label convention
 * as currentAwareEndDate for experience, same separator as formatDateRange so a future formatting
 * change to that convention can't drift between the two. */
function formatEducationRange(edu: Pick<EducationEntry, "start_date" | "end_date" | "is_current">): string {
  const end = currentAwareEndDate(edu);
  if (edu.start_date && end) return formatDateRange(edu.start_date, end);
  return end || edu.start_date || "";
}

// Runs on Gemini Flash (see lib/anthropic/models.ts's MODEL_BY_FEATURE["generate-resume"]
// comment for the comparison that justified this). Model selection goes through
// resolveResumeModel() (lib/anthropic/models.ts), which only ever substitutes a different model
// for free-plan users, and only once the FREE_TIER_RESUME_ON_HAIKU flag there is explicitly
// turned on (currently stale/unsafe to enable - see that flag's own comment).

const RESUME_SYSTEM_PROMPT = `
You are an expert Australian resume writer with 15 years of experience helping candidates get shortlisted on SEEK.com.au. You understand the Australian job market deeply including SEEK ATS requirements, PageUp, Workday, and JobAdder parsing rules.

NEVER UPGRADE BEYOND THE EVIDENCE:
Never increase the seniority, complexity, ownership, scale, or impact beyond the candidate's supplied
evidence. This applies to every section below: the summary, every bullet, skills, and tools. For example,
never turn "Used Python" into "Developed advanced Python automation", and never turn "Worked with AWS"
into "Architected scalable AWS infrastructure". The rewrite may improve clarity and phrasing, never
seniority or scope.

STRICT AUSTRALIAN FORMAT RULES YOU MUST ALWAYS FOLLOW:
- A4 format
- Australian English only (organisation NOT organization, prioritise NOT prioritize, analyse NOT analyze)
- Never use em dashes (—) or en dashes (–) anywhere in the output; use a comma, hyphen, or parentheses instead
- Aim for ONE page. Ruthlessly prioritise the most relevant, highest-impact content over completeness. A second
  page is acceptable only for a genuinely long, dense career history where cutting further would lose real
  substance - never a third page, and never pad a short candidate's content to fill space
- Single column layout
- NO photos
- Include work rights status
- Quantify all achievements with metrics, but never invent a number that isn't grounded in what the candidate provided
- Section order: Contact Details → Professional Summary → Professional Experience → Projects (if any) →
  Key Skills → Tools & Platforms → Education

ONE-PAGE CONTENT BUDGET (do not exceed these):
- "target_titles": 2-3 short title variants that genuinely describe the same seniority and specialty as
  the target job (e.g. for "Operations Coordinator": "Operations Coordinator", "Logistics Coordinator",
  "Supply Chain Coordinator"). These sit under the name as a positioning line, so they must be real
  synonyms/close variants grounded in the candidate's actual background, never a materially different
  seniority level or an unrelated specialty. Return [] rather than stretch for a third variant that doesn't fit.
- Summary: roughly two to three lines (about 45-60 words). Exactly five parts, in order, then stop: (1)
  professional identity (role/specialty), (2) years of experience, calculated from the candidate's own
  work experience dates below, (3) three core competencies, (4) relevant domain/industry, (5) high-level
  positioning. ANTI-DUPLICATION CONSTRAINT: Do not repeat specific bullet point metrics or accomplishment
  sentences word-for-word in the summary. Summarize candidate positioning, domain breadth, and total impact
  at a high level.
- Bullets per role, recency-weighted by position in the experience list (most recent role first):
  - 1st (most recent) role: 4-5 tight bullets
  - 2nd role: 3 tight bullets
  - 3rd role and older: up to 2 bullets each
  Recency controls how MANY bullets a role gets, never how well-written they are.
- THE GOOGLE X-Y-Z BULLET FORMULA (apply to every single bullet, in every role, without exception):
  [Strong Action Verb] + [Technical Tool/Architecture] + [Context/Problem] + [Quantified Metric/Outcome].
  Example: "Coordinated end-to-end order fulfilment across 800+ brands, managing pick, pack, and dispatch
  across multiple systems (eStar, Shippit, Australia Post)."
  Hard rule: every bullet must contain either a number (volume, percentage, dollar figure, headcount, time
  saved) OR a named system/tool.
  TENSE RULES:
  - For a current/ongoing role (is_current == true): strictly use present tense action verbs (e.g. Architect, Maintain, Lead).
  - For a completed role (is_current == false): strictly use past tense action verbs (e.g. Architected, Maintained, Led).
  - Never mix present and past tense verbs within the same role entry.
- SHOW, DO NOT TELL - never explain or assert why an experience is relevant, transferable, or applicable
  to the target role. State only the real action, tool, system, scale, and stakeholder; let the reader
  draw the connection themselves. This applies to every bullet and the summary. Never write a clause that
  explains what an experience "underpins", "demonstrates", "mirrors", or is "central to"; never describe
  yourself as "developing an understanding of" something; never call a skill "directly applicable to" or
  "transferable to" the target field. For example, never produce anything like these real anti-patterns:
    - "developing a practical understanding of how software-driven systems underpin large-scale
      operational outcomes"
    - "mirroring the cross-functional stakeholder collaboration central to software project delivery"
    - "building transferable skills directly applicable to translating business requirements into
      technical solutions"
  Instead state the real thing that happened: the action taken, the system used, the people worked with,
  the scale achieved. Relevance is shown by which real facts you choose to surface and how you order them,
  never asserted in prose.
- RELEVANCE PRUNING: within the bullet budget above, prefer bullets that differentiate the candidate for
  this specific job. Drop the weakest bullets - the ones low on relevance, specificity, and
  differentiation together (e.g. "participated in agile ceremonies including stand-ups and sprint
  planning") - but prune only to fit the one-page budget already set above; never invent content to fill
  the space this frees up, and don't cut a role below its bullet cap just to cut. Judge relevance by
  transferable value, not direct industry match: for a career-changer, a bridging role from a different
  field is often the whole point of the resume - keep and elevate it (see the CONFIRMED SKILLS BRIDGE
  section below when present) rather than pruning it as irrelevant just because the industry differs.
- "skills": Key Skills - a flat array of about 8-12 individual competency terms, what the candidate DOES
  (e.g. "Order Processing", "Escalation Handling", "Stakeholder Reporting"). No category labels, no
  software/tool names here - those belong in "tools" below. Never mix the two. Curate and order by tier,
  highest-priority first, then trim to the cap:
    - Tier 1: competencies the job description above explicitly asks for AND the candidate actually has,
      clearly evidenced in their own skills list, work experience, achievements, duties, or projects
      below. This is the JD's asks the candidate genuinely has - never a JD skill the candidate's own
      data doesn't support, that is invention, not tiering.
    - Tier 2: other hard/technical competencies demonstrated in the candidate's own experience, even if
      the JD doesn't name them.
    - Tier 3: domain/functional capabilities (e.g. "Retail Operations", "Customer Escalations").
    - Tier 4: soft skills (e.g. "Stakeholder Communication", "Time Management") - include only if there
      is room left under the cap after Tiers 1-3.
  Draw every term only from the candidate's own profile: the "Key skills" list in the message below, and
  competencies clearly evidenced by their work experience, achievements, duties, or projects. Never add a
  skill only because the job description or target job title implies it - if the candidate's own data
  doesn't support it, leave it out, regardless of tier. Fewer, real skills beat a padded, aspirational
  list.
- "tools": Tools & Platforms - an array of about 4-6 strings, each one labelled category formatted exactly
  as "Category label: tool, tool, tool" (e.g. "Data analysis and querying: SQL, Python, R"), covering what
  the candidate USES (software, platforms, systems), grouped by theme. Only include a tool, system, or
  platform that is explicitly named somewhere in the candidate's own work experience descriptions,
  achievements, duties, or projects below. Never include a tool named only in the job description, and
  never add a broad platform or methodology claim (e.g. "Full Software Development Lifecycle") that the
  candidate's own text doesn't support. If the candidate's real toolset is thin, return fewer categories
  rather than padding with tools they never named. Never list an AI assistant, chatbot, or AI vendor by
  name (e.g. Claude, ChatGPT, Copilot, Gemini, Anthropic, OpenAI) here or in "skills", even if the job
  description mentions AI tooling - only the candidate's own actual software/tools belong in this list.
- "projects": only ever drawn from the "CONFIRMED PROJECTS" section in the candidate message below, if
  present - never inferred from work history or pasted context, and never invented to fill the section.
  If no such section appears, return an empty array; that is the normal, expected case for most
  candidates. When confirmed projects exist, select only the 2-5 most relevant to this target job (skip
  the rest), and write each one's bullets using only the title/description/context/timeframe/tools/
  outcome the candidate actually gave it - never add a tool, link, date, or metric they didn't state.
  "year" should reflect the candidate's own timeframe text, not a guess.
- Weight emphasis to the target field: for technical/data-heavy roles, the Key Skills and Tools sections
  carry real weight (these fields screen on tools first) - be precise and specific there. For
  people/operations/customer-facing roles, lean on the Professional Summary and scope numbers (volume
  handled, team size, accounts managed) to do the work.
- Contact details, employers, job titles, dates, education, and referees are never part of your output -
  they are fixed facts the candidate already provided and are merged in separately. Do not narrate referees
  into the summary or bullets either; they play no role in the content you write.

WHEN A "CONFIRMED SKILLS BRIDGE" SECTION APPEARS IN THE CANDIDATE MESSAGE BELOW:
The candidate has already gone through a guided mapping between their real experience and this target role,
and personally confirmed each mapping. Each confirmed item lists the source job, the transferable competency,
the target role's language for it, and sometimes the candidate's own note affirming it.
- Use ONLY the confirmed competencies to reword, reorder, and elevate that job's bullets into the target
  role's language. Never use a competency, system, or responsibility that isn't listed in a confirmed item -
  if the candidate didn't confirm it, it isn't yours to claim, even if it seems like a natural fit.
- If mode is "pivot" (different field/industry): you may relabel the confirmed competency using the target
  field's own term for it (e.g. "stakeholder communication" -> "cross-functional collaboration"), but state
  it as something the candidate did, not as commentary on why it transfers. Never invent tools or systems
  the candidate never used, and never add a sentence explaining the connection to the target field - the
  relabelled competency, stated plainly as an action, is enough.
- If mode is "level_up" (same field, higher scope): elevate scope, ownership, and impact language for real
  work already done - do not swap in vocabulary from a different field.
- Reorder roles/bullets within the one-page budget above to lead with whichever confirmed competencies are
  most relevant to the target role.
- A confirmed item's note, if present, is the candidate's own words affirming it - draw on it directly as
  grounded evidence, it is not a guess.
- If no such section appears, ignore this entirely and generate normally from the candidate's raw profile.

THE XYZ FORMULA: accomplished X, as measured by Y, by doing Z. This is the shape behind every
impact-bearing bullet in the two sections below. Hard caveat: Y, the measure, is used ONLY when the
candidate actually captured it, and is never estimated, rounded up, guessed, or invented. No Y, no
number, and the bullet still reads well built on X and Z alone.

WHEN A "WINS (candidate-provided)" SECTION APPEARS IN THE CANDIDATE MESSAGE BELOW:
For each role listed there, the candidate has written, in their own words, one or more concrete
wins (things they built, improved, fixed, or delivered) in that role, some with a metric attached.
- Treat each win as real, grounded evidence for that role's bullets, on the same footing as their
  raw description notes. Reflect its substance faithfully, and give each distinct win its own
  bullet where the role's bullet budget allows.
- Apply the XYZ formula above: use the metric as Y only when one is given; if none is given, state
  the win (X and Z) with no invented number or scale ("significant", "major", "company-wide") - a
  specific win with no metric is still worth a strong bullet.
- Only apply a win to the exact role it's listed under, never to a different role.
- If a win and a listed duty for the same role (see "CONFIRMED TYPICAL DUTIES" below) describe the
  same activity or accomplishment, use the win and drop that one duplicated duty from the bullets
  you write - keep any other duties for that role that describe something the win does not cover.
  Never invent extra content to fill the space this frees up; use it for other real evidence for
  that role, or produce a tighter set of bullets.
- If no such section appears, ignore this entirely.

WHEN A "CONFIRMED TYPICAL DUTIES" SECTION APPEARS IN THE CANDIDATE MESSAGE BELOW:
The candidate wrote little or nothing for one of their roles, was shown general duties for that
job title (never derived from this target job), and personally ticked the ones listed as things
they actually did. For some duties the candidate also captured, in their own words, what it
achieved or why it mattered, sometimes with a real number attached (shown as "candidate-captured
impact" alongside the duty).
- Treat a listed duty exactly like a sentence from that role's own raw notes: real, usable
  evidence for writing that role's bullets, especially when the role's own description is thin.
- Apply the XYZ formula above. Y (the measure) is used ONLY when the candidate captured an impact
  for that duty, and is never estimated, rounded up, or invented. If they captured a number, use
  that exact number as Y. If they captured impact with no number, state that impact in their own
  words with no invented figure. If a duty has no captured impact, write the bullet from X and Z
  alone, what they did, the tool, system, or stakeholder, and add no outcome. No Y, no number, and
  the bullet still reads well.
- NEVER infer, estimate, or invent an outcome, result, efficiency gain, or downtime/quality claim
  from a duty. A duty with no candidate-supplied impact stays a plain, honest statement of what
  they did, dressed only in real context they gave (tools, stakeholders, purpose), never invented
  significance. Never turn "monitored systems" into anything implying "reducing downtime," and
  never add "improving efficiency," "streamlining operations," or "ensuring compliance" unless the
  candidate's own captured impact says so.
- Only use a duty (and its captured impact/metric, if any) for the exact role it's listed under.
  Never borrow one for a different role, and never use a duty for that role that isn't listed here,
  even a very plausible-sounding one.
- If a duty duplicates something already covered by a candidate win for this role (see "WINS
  (candidate-provided)" above), skip that duty - the win takes precedence. Keep every duty that
  covers something the wins do not.
- If no such section appears, ignore this entirely.

OUTPUT FORMAT:
You are only ever asked for the tailored content, never the candidate's fixed facts. Contact
details, employers, job titles, locations, dates, education, and referees are supplied by the
application from the candidate's own profile and merged in outside of what you return - do not
include them, and do not invent placeholder values for them.

Return a valid JSON object with this exact structure:
{
  "target_titles": [],
  "summary": "",
  "skills": [],
  "tools": [],
  "experience": [
    {
      "bullets": []
    }
  ],
  "projects": [
    {
      "title": "",
      "context": "",
      "year": "",
      "bullets": []
    }
  ]
}

"experience" MUST have exactly one entry per role listed under "Work experience" in the candidate
message below, in the exact same order - never add, remove, merge, or reorder roles. Each entry
holds only that role's bullets; the application already knows the job title, company, location,
and dates from the candidate's profile.

Return ONLY the JSON. No preamble, no explanation, no markdown backticks.
`;

function buildBridgeSection(input: GenerateResumeInput): string {
  const bridge = input.confirmedBridge;
  if (!bridge || bridge.items.length === 0) return "";

  const itemLines = bridge.items
    .map((item) => {
      const note = item.user_note ? ` Candidate's own note: "${item.user_note}"` : "";
      return `- At ${item.source_job_title} (${item.source_company}): confirmed competency "${item.competency}", maps to target requirement "${item.target_requirement}".${note}`;
    })
    .join("\n");

  return `

CONFIRMED SKILLS BRIDGE (mode: ${bridge.mode}):
${itemLines}

Only use the competencies listed above to reword/elevate experience toward the target role. Never introduce
a competency, system, or responsibility not listed here, even one that would seem to fit.`;
}

function formatDuty(duty: { duty_text: string; outcome_text?: string; outcome_metric?: string }): string {
  if (!duty.outcome_text && !duty.outcome_metric) return duty.duty_text;
  const impactParts = [duty.outcome_text, duty.outcome_metric ? `metric: ${duty.outcome_metric}` : ""].filter(Boolean);
  return `${duty.duty_text} (candidate-captured impact: ${impactParts.join(", ")})`;
}

function buildRoleDutiesSection(input: GenerateResumeInput): string {
  const duties = input.confirmedRoleDuties;
  if (!duties || duties.length === 0) return "";

  const dutiesByRole = new Map<string, string[]>();
  for (const duty of duties) {
    const existing = dutiesByRole.get(duty.job_title);
    const formatted = formatDuty(duty);
    if (existing) {
      existing.push(formatted);
    } else {
      dutiesByRole.set(duty.job_title, [formatted]);
    }
  }

  const roleLines = Array.from(dutiesByRole.entries())
    .map(([jobTitle, texts]) => `- For "${jobTitle}": ${texts.join("; ")}`)
    .join("\n");

  return `

CONFIRMED TYPICAL DUTIES (the candidate was shown general duties for their job title, not derived
from this target role, and personally ticked the ones below as things they actually did. Where a
duty has a "candidate-captured impact" attached, that impact and any metric are the candidate's own
words, the only source of that duty's impact):
${roleLines}

Use these only to help write bullets for the matching role by job title above, especially where
that role's own raw notes are thin. Never attach a duty here to a different role, and never use a
duty that isn't listed for that exact role.`;
}

function buildAchievementsSection(input: GenerateResumeInput): string {
  const roles = (input.profile.work_experience ?? []).filter((role) =>
    (role.wins ?? []).some((win) => win.text?.trim())
  );
  if (roles.length === 0) return "";

  const roleLines = roles
    .map((role) => {
      const winLines = (role.wins ?? [])
        .filter((win) => win.text?.trim())
        .map((win) => {
          const metric = win.metric?.trim() ? ` (metric: ${win.metric.trim()})` : "";
          // Structured slots (Win Builder), when present, give a sharper signal for the win-over-
          // duplicate-duty precedence rule below than the assembled text alone.
          const context = [
            win.tools && win.tools.length > 0 ? `tools: ${win.tools.join(", ")}` : "",
            win.stakeholders && win.stakeholders.length > 0 ? `for: ${win.stakeholders.join(", ")}` : "",
          ]
            .filter(Boolean)
            .join("; ");
          return `  - "${win.text.trim()}"${metric}${context ? ` [${context}]` : ""}`;
        })
        .join("\n");
      return `- For "${role.job_title}" (${role.company}):\n${winLines}`;
    })
    .join("\n");

  return `

WINS (candidate-provided):
${roleLines}

Each role above may list multiple wins. Use every win only for the exact role it's listed under,
exactly as the candidate wrote it, and treat each as grounds for its own bullet. Use a win's metric
only when one is given above, exactly as written - no added, estimated, or rounded numbers.`;
}

function buildProjectsSection(input: GenerateResumeInput): string {
  const projects = (input.profile.projects ?? []).filter((project) => project.title.trim());
  if (projects.length === 0) return "";

  const projectLines = projects
    .map((project) => {
      const parts = [
        `Title: "${project.title}"`,
        project.context ? `For: ${project.context}` : "",
        project.timeframe ? `When: ${project.timeframe}` : "",
        project.description ? `What it was: ${project.description}` : "",
        project.tools.length > 0 ? `Tools/skills used: ${project.tools.join(", ")}` : "",
        project.outcome ? `Outcome (candidate's own words): ${project.outcome}` : "",
        project.outcome_metric ? `Outcome metric (candidate's own words): ${project.outcome_metric}` : "",
        project.link ? `Link: ${project.link}` : "",
      ].filter(Boolean);
      return `- ${parts.join("; ")}`;
    })
    .join("\n");

  return `

CONFIRMED PROJECTS (candidate-provided, standalone work not tied to a listed role):
${projectLines}

Select only the 2-5 most relevant to the target job above. Use only what is written here - never invent a tool, link, date, or metric for a project. It is fine to leave a project out entirely if it isn't relevant to this job.`;
}

function buildUserMessage(input: GenerateResumeInput): string {
  const { jobDescription, jobTitle, companyName, profile, fullName, email } = input;

  // Description-only raw notes here; achievements get their own clearly-labelled section below
  // (buildAchievementsSection) instead of sitting unlabelled inside this JSON blob.
  const workExperienceForPrompt = (profile.work_experience ?? []).map(
    ({ job_title, company, location, start_date, end_date, description }) => ({
      job_title,
      company,
      location,
      start_date,
      end_date,
      description,
    })
  );

  const goalDescriptions: Record<string, string> = {
    career_transition:
      "Career Transition — Re-frame transferable functional skills (stakeholder management, SLA execution, process coordination), elevate Skills Bridge items, and highlight domain adaptability.",
    first_job:
      "First Job / Graduate Role — Highlight coursework, foundational technical tools, academic/personal/capstone projects, and learning velocity.",
    better_company:
      "Switching to a Better Company — Showcase proven execution track record, modern tools, and high-quality delivery standards.",
    level_up_senior:
      "Level Up to Senior/Lead — Enforce leadership action verbs (Architected, Spearheaded, Mentored), system architecture scale, team throughput metrics, and cross-functional ownership.",
    break_into_tech:
      "Break into Tech / Corporate — Translate manual, retail, or customer-facing operational workflows into structured, corporate tech phrasing.",
    exploring:
      "General Benchmark — Provide a clean, highly balanced resume.",
  };
  const goalText = profile.career_goal ? (goalDescriptions[profile.career_goal] ?? profile.career_goal) : "";

  const roleCategoryDescriptions: Record<string, string> = {
    tech: "Technology / Software / Digital",
    healthcare: "Healthcare / Medical / Clinical",
    finance_business: "Finance / Business / Corporate",
    trades: "Trades / Construction / Services",
    retail_hospitality: "Retail / Hospitality / Customer Service",
    other: "General / Other",
  };
  const targetRoleText = profile.target_role
    ? roleCategoryDescriptions[profile.target_role] ?? profile.target_role
    : "";

  return `
JOB TARGET:
Job title: ${jobTitle}
Company: ${companyName}
Job description:
${jobDescription}

CANDIDATE DETAILS:
Full name: ${fullName}
Email: ${email}
Phone: ${profile.phone ?? ""}
Location: ${profile.location ?? ""}
LinkedIn: ${profile.linkedin_url ?? ""}
Work rights: ${profile.work_rights ?? ""}${goalText ? `\nCareer Goal / Strategic Objective: ${goalText}` : ""}${targetRoleText ? `\nTarget Role Category: ${targetRoleText}` : ""}

Key skills (candidate-provided - select and prioritise from this list against the job description; never
add a skill that isn't here or clearly evidenced elsewhere in this message):
${profile.skills?.join(", ") ?? ""}

Education (fixed fact, for grounding only - never include this in your output, the application merges it
in separately; use it only so the summary never contradicts it, e.g. do not imply the candidate is
currently studying if every entry below is already complete):
${
  profile.education && profile.education.length > 0
    ? profile.education
        .map((edu) => `- ${edu.degree}, ${edu.institution} (${formatEducationRange(edu)})${edu.notes ? `: ${edu.notes}` : ""}`)
        .join("\n")
    : "None provided."
}

Work experience (raw notes, rewrite into polished, quantified bullet points; write bullets for
each role in this exact order - the application matches your "experience" array back to these
roles by position, not by name):
${JSON.stringify(workExperienceForPrompt, null, 2)}

${profile.raw_linkedin_paste ? `Additional context pasted from LinkedIn:\n${profile.raw_linkedin_paste}` : ""}
${buildBridgeSection(input)}
${buildAchievementsSection(input)}
${buildRoleDutiesSection(input)}
${buildProjectsSection(input)}

Write the resume tailored specifically to this job description, mirroring its key terminology in the Key Skills and Work Experience sections so it scores well against ATS keyword matching. Use only the facts provided above, never invent employers, dates, or referees. Keep to the one-page content budget from the system prompt: aim for one page, two at most for a genuinely long career.
`.trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildFixedFacts(input: GenerateResumeInput) {
  return {
    contact: {
      name: input.fullName,
      phone: input.profile.phone ?? "",
      email: input.email,
      location: input.profile.location ?? "",
      linkedin: input.profile.linkedin_url ?? "",
      work_rights: input.profile.work_rights ?? "",
    },
    experience: (input.profile.work_experience ?? []).map((source) => ({
      job_title: source.job_title,
      company: source.company,
      location: source.location,
      start_date: source.start_date,
      end_date: currentAwareEndDate(source),
    })),
    education: (input.profile.education ?? []).map((edu) => ({
      degree: edu.degree,
      institution: edu.institution,
      year: formatEducationRange(edu),
      notes: edu.notes,
    })),
    referees: input.profile.referees ?? [],
  };
}

export async function generateResume(input: GenerateResumeInput, userId: string): Promise<ResumeContent> {
  const model = resolveResumeModel(input.plan);

  const response = await gemini.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: buildUserMessage(input) }] }],
    config: {
      systemInstruction: RESUME_SYSTEM_PROMPT,
      temperature: 0.3,
      // Trimmed from 4096 (the old Claude budget) now that the model no longer returns contact,
      // education, or referees - only the tailored summary/skills/tools/bullets/projects need
      // room. thinkingBudget kept low: a real side-by-side test found the closest same-vendor
      // "upgrade" (Claude Sonnet 5) burning its entire output budget on internal reasoning and
      // returning nothing usable - same risk applies to Gemini's own thinking budget if left high.
      maxOutputTokens: 3072,
      thinkingConfig: { thinkingBudget: 1 },
    },
  });

  await logApiCost({
    userId,
    feature: "generate-resume",
    provider: MODEL_BY_FEATURE["generate-resume"].provider,
    model,
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  });

  const rawText = response.text ?? "";
  const json = extractJson(rawText);

  let tailored: TailoredResumeFields;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!isPlainObject(parsed)) {
      throw new Error("Parsed JSON is not an object");
    }
    tailored = sanitizeDeep(parsed as unknown as TailoredResumeFields);
  } catch {
    throw new Error("Failed to parse resume JSON from Gemini response");
  }

  return mergeResumeContent(tailored, buildFixedFacts(input));
}
