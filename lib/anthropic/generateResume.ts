import { anthropic } from "@/lib/anthropic/client";
import { resolveResumeModel } from "@/lib/anthropic/models";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import { stripAiVendorMentions } from "@/lib/resume/stripAiVendorMentions";
import type { GenerateResumeInput, ResumeContent, ResumeProjectEntry } from "@/types";

// STAYS ON SONNET - do not move this to Haiku. This is the product: resume writing quality
// (bullet phrasing, ATS keyword mirroring, one-page content judgement) is what people pay for,
// and it's the one call site where a quality regression is directly visible to every user. Model
// selection goes through resolveResumeModel() (lib/anthropic/models.ts), which only ever
// substitutes Haiku for free-plan users, and only once the FREE_TIER_RESUME_ON_HAIKU flag there
// is explicitly turned on.

const RESUME_SYSTEM_PROMPT = `
You are an expert Australian resume writer with 15 years of experience helping candidates get shortlisted on SEEK.com.au. You understand the Australian job market deeply including SEEK ATS requirements, PageUp, Workday, and JobAdder parsing rules.

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
- Summary: 3-4 lines, about 60-85 words total. No filler adjectives ("passionate", "dynamic", "results-oriented").
  One breath: years of experience + domains worked in + core strength, ideally with one proof point.
- Bullets per role, recency-weighted by position in the experience list (most recent role first):
  - 1st (most recent) role: up to 6-8 tight bullets
  - 2nd role: up to 5 bullets
  - 3rd role: up to 3 bullets
  - 4th role and older: up to 2 bullets each
  Recency controls how MANY bullets a role gets, never how well-written they are. Every role's bullets,
  including the oldest ones with only 2, must be fully polished to the bullet formula below, not a lower
  quality bar because the role is old.
- THE BULLET FORMULA (apply to every single bullet, in every role, without exception):
  Action verb + what you did + scope/scale + system or outcome.
  Example: "Coordinated end-to-end order fulfilment across 800+ brands, managing pick, pack, and dispatch
  across multiple systems (eStar, Shippit, Australia Post)."
  Hard rule: every bullet must contain either a number (volume, percentage, dollar figure, headcount, time
  saved) OR a named system/tool. A bullet with neither is too vague - rewrite it or cut it, never leave it
  as filler. Only use numbers/systems the candidate's own data actually supports; never invent one.
  Start every bullet with a verb. Keep tense consistent within a role: past tense for a completed role,
  present tense is fine for the current/ongoing role. Keep phrasing tight and parallel across bullets in
  the same role. Prioritise outcomes and scope over restating responsibilities.
- "skills": Key Skills - a flat array of about 8-14 individual competency terms, what the candidate DOES
  (e.g. "Order Processing", "Escalation Handling", "Stakeholder Reporting"). No category labels, no
  software/tool names here - those belong in "tools" below. Never mix the two.
- "tools": Tools & Platforms - an array of about 4-6 strings, each one labelled category formatted exactly
  as "Category label: tool, tool, tool" (e.g. "Data analysis and querying: SQL, Python, R"), covering what
  the candidate USES (software, platforms, systems), grouped by theme and adapted to the candidate's real
  toolset and the target job. Never list an AI assistant, chatbot, or AI vendor by name (e.g. Claude,
  ChatGPT, Copilot, Gemini, Anthropic, OpenAI) here or in "skills", even if the job description mentions
  AI tooling - only the candidate's own actual software/tools belong in this list.
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
- If mode is "pivot" (different field/industry): translate vocabulary - retitle the transferable competency
  in the target field's terms, without inventing tools or systems the candidate never used.
- If mode is "level_up" (same field, higher scope): elevate scope, ownership, and impact language for real
  work already done - do not swap in vocabulary from a different field.
- Reorder roles/bullets within the one-page budget above to lead with whichever confirmed competencies are
  most relevant to the target role.
- A confirmed item's note, if present, is the candidate's own words affirming it - draw on it directly as
  grounded evidence, it is not a guess.
- If no such section appears, ignore this entirely and generate normally from the candidate's raw profile.

WHEN AN "ACHIEVEMENTS (candidate-provided)" SECTION APPEARS IN THE CANDIDATE MESSAGE BELOW:
For each role listed there, the candidate has written, in their own words, one concrete thing they
built, improved, fixed, or delivered in that role.
- Treat it as real, grounded evidence for that role's bullets, on the same footing as their raw
  description notes. Reflect its substance faithfully.
- Use ONLY the number, scale, or detail the candidate actually wrote. If they gave no number, do
  not add one, round one, or imply a scale ("significant", "major", "company-wide") they didn't
  state - a specific achievement with no metric is still worth a strong bullet built on what they
  actually said.
- Only apply an achievement to the exact role it's listed under, never to a different role.
- If no such section appears, ignore this entirely.

WHEN A "CONFIRMED TYPICAL DUTIES" SECTION APPEARS IN THE CANDIDATE MESSAGE BELOW:
The candidate wrote little or nothing for one of their roles, was shown general duties for that
job title (never derived from this target job), and personally ticked the ones listed as things
they actually did.
- Treat a listed duty exactly like a sentence from that role's own raw notes: real, usable
  evidence for writing that role's bullets, especially when the role's own description is thin.
- Only use a duty for the exact role it's listed under. Never borrow one for a different role, and
  never use a duty for that role that isn't listed here, even a very plausible-sounding one.
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

function buildRoleDutiesSection(input: GenerateResumeInput): string {
  const duties = input.confirmedRoleDuties;
  if (!duties || duties.length === 0) return "";

  const dutiesByRole = new Map<string, string[]>();
  for (const duty of duties) {
    const existing = dutiesByRole.get(duty.job_title);
    if (existing) {
      existing.push(duty.duty_text);
    } else {
      dutiesByRole.set(duty.job_title, [duty.duty_text]);
    }
  }

  const roleLines = Array.from(dutiesByRole.entries())
    .map(([jobTitle, texts]) => `- For "${jobTitle}": ${texts.join("; ")}`)
    .join("\n");

  return `

CONFIRMED TYPICAL DUTIES (the candidate was shown general duties for their job title, not derived
from this target role, and personally ticked the ones below as things they actually did):
${roleLines}

Use these only to help write bullets for the matching role by job title above, especially where
that role's own raw notes are thin. Never attach a duty here to a different role, and never use a
duty that isn't listed for that exact role.`;
}

function buildAchievementsSection(input: GenerateResumeInput): string {
  const roles = (input.profile.work_experience ?? []).filter((role) => role.achievement?.trim());
  if (roles.length === 0) return "";

  const roleLines = roles
    .map((role) => `- For "${role.job_title}" (${role.company}): "${role.achievement.trim()}"`)
    .join("\n");

  return `

ACHIEVEMENTS (candidate-provided):
${roleLines}

Use each achievement only for the exact role it's listed under, exactly as the candidate wrote it - no
added numbers or scale.`;
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
        project.link ? `Link: ${project.link}` : "",
      ].filter(Boolean);
      return `- ${parts.join("; ")}`;
    })
    .join("\n");

  return `

CONFIRMED PROJECTS (candidate-provided, standalone work not tied to a listed role):
${projectLines}

Select only the 2-5 most relevant to the target job above. Use only what is written here - never
invent a tool, link, date, or metric for a project. It is fine to leave a project out entirely if
it isn't relevant to this job.`;
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
Work rights: ${profile.work_rights ?? ""}

Key skills (candidate-provided, expand/prioritise against the job description):
${profile.skills?.join(", ") ?? ""}

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

interface TailoredExperienceEntry {
  bullets: string[];
}

/** The model's trimmed output: only the parts that require tailoring judgement. Contact details,
 * employers, job titles, dates, education, and referees are fixed facts already known from the
 * profile and are merged in by mergeResumeContent below, never regenerated by the model. */
interface TailoredResumeContent {
  target_titles: string[];
  summary: string;
  skills: string[];
  tools: string[];
  experience: TailoredExperienceEntry[];
  projects: ResumeProjectEntry[];
}

/**
 * Reconstructs the full ResumeContent the rest of the app expects (templates, preview, export,
 * factCheck) by merging the model's tailored output with fixed facts taken straight from the
 * profile/account. Employers, job titles, dates, education, and referees therefore can never be
 * altered or fabricated by the model - they never pass through it - which strengthens the
 * never-fabricate guarantee for those fields and should reduce fact-check flags on them.
 * "experience" is matched by array position: the system prompt instructs the model to return
 * exactly one entry per role, in the same order as the "Work experience" list in the user message.
 */
function mergeResumeContent(tailored: TailoredResumeContent, input: GenerateResumeInput): ResumeContent {
  const sourceExperience = input.profile.work_experience ?? [];
  const tailoredExperience = tailored.experience ?? [];

  return {
    contact: {
      name: input.fullName,
      phone: input.profile.phone ?? "",
      email: input.email,
      location: input.profile.location ?? "",
      linkedin: input.profile.linkedin_url ?? "",
      work_rights: input.profile.work_rights ?? "",
    },
    target_titles: tailored.target_titles ?? [],
    summary: tailored.summary ?? "",
    skills: stripAiVendorMentions(tailored.skills ?? []),
    tools: stripAiVendorMentions(tailored.tools ?? []),
    experience: sourceExperience.map((source, index) => ({
      job_title: source.job_title,
      company: source.company,
      company_description: "",
      location: source.location,
      start_date: source.start_date,
      end_date: source.end_date,
      bullets: tailoredExperience[index]?.bullets ?? [],
    })),
    projects: tailored.projects ?? [],
    education: input.profile.education ?? [],
    referees: input.profile.referees ?? [],
  };
}

export async function generateResume(input: GenerateResumeInput, userId: string): Promise<ResumeContent> {
  const model = resolveResumeModel(input.plan);

  const message = await anthropic.messages.create({
    model,
    // Trimmed from 4096 now that the model no longer returns contact, education, or referees -
    // only the tailored summary/skills/tools/bullets/projects need room.
    max_tokens: 3072,
    system: [{ type: "text", text: RESUME_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildUserMessage(input) }],
  });

  await logApiCost({
    userId,
    feature: "generate-resume",
    model,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheCreationInputTokens: message.usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: message.usage.cache_read_input_tokens ?? 0,
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const json = extractJson(block.text);

  let tailored: TailoredResumeContent;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!isPlainObject(parsed)) {
      throw new Error("Parsed JSON is not an object");
    }
    tailored = sanitizeDeep(parsed as unknown as TailoredResumeContent);
  } catch {
    throw new Error("Failed to parse resume JSON from Claude response");
  }

  return mergeResumeContent(tailored, input);
}
