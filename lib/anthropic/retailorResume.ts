import { anthropic } from "@/lib/anthropic/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import { formatCompactJobAdFull } from "@/lib/anthropic/formatCompactJobAd";
import { mergeResumeContent, type TailoredResumeFields } from "@/lib/resume/mergeResumeContent";
import type { CompactJobAd } from "@/lib/anthropic/parseJobAd";
import type { ResumeContent } from "@/types";

const FEATURE = "duplicate-retailor" as const;

export interface RetailorTarget {
  jobTitle: string;
  companyName: string;
  compactJobAd: CompactJobAd;
}

export class RetailorResumeError extends Error {}

const RETAILOR_SYSTEM_PROMPT = `
You are an expert Australian resume writer with 15 years of experience helping candidates get
shortlisted on SEEK.com.au. You are given an EXISTING, already-tailored resume (as JSON) and a
NEW job the candidate now wants to apply for.

Adjust the resume to fit the new job:
- Rework the professional summary to speak to the new role, staying within 3-4 lines (about
  60-85 words). No filler adjectives.
- Update "target_titles" (2-3 short title variants under the name) to genuinely match the new
  target role and the candidate's real seniority/specialty - never a materially different
  seniority level. Return [] if nothing fits well.
- Re-order and re-emphasise "skills" (Key Skills, flat competency terms) and bullet phrasing to
  mirror the new job's keywords, for ATS keyword matching, but do not lengthen bullets or add new
  ones - the resume should still fit within a page or two, so keep bullet counts and lengths
  comparable to the original. Every bullet must still contain a number or a named system - if
  re-emphasis would strip that out, keep the original bullet instead.
- "tools" (Tools & Platforms, labelled category rows "Category label: item, item, item", about
  4-6 categories) must stay in that labelled format - re-emphasise which items lead within each
  category, don't flatten it back into an unlabelled list, don't mix skills into it. Never list an
  AI assistant, chatbot, or AI vendor by name (e.g. Claude, ChatGPT, Copilot, Gemini, Anthropic,
  OpenAI) here or in "skills", even if the new job mentions AI tooling.
- Experience bullets: re-emphasise phrasing per role the same way, same bullet count and order as
  the existing resume - never add, remove, or reorder a role's bullets beyond re-emphasis.
- Project bullets, if the existing resume has any: re-emphasise phrasing the same way as
  experience bullets - never add, remove, or reorder a project, and never invent a new one.

You are only ever asked for the tailoring judgement, never the candidate's fixed facts. Contact
details, employers, job titles, locations, dates, education, referees, and each project's own
title/context/year are supplied by the application from the existing resume and merged in outside
of what you return - do not include them, and do not invent placeholder values for them.

Preserve the original section order and the original number of roles/projects/bullets per
role/project. Australian English spelling throughout (organisation, prioritise, analyse). Never
use em dashes (—) or en dashes (–); use a comma, hyphen, or parentheses instead.

Return a valid JSON object in EXACTLY this shape:
{
  "target_titles": [],
  "summary": "",
  "skills": [],
  "tools": [],
  "experience": [
    { "bullets": [] }
  ],
  "projects": [
    { "bullets": [] }
  ]
}

"experience" MUST have exactly one entry per role in the existing resume below, in the same
order - never add, remove, merge, or reorder roles. "projects" MUST have exactly one entry per
project in the existing resume below, in the same order - never add, remove, merge, or reorder
projects; return [] only if the existing resume has no projects.

Return ONLY the JSON. No preamble, no explanation, no markdown backticks.
`;

function buildUserMessage(existing: ResumeContent, target: RetailorTarget): string {
  return `
NEW JOB TARGET:
Job title: ${target.jobTitle}
Company: ${target.companyName}
Job facts:
${formatCompactJobAdFull(target.compactJobAd)}

EXISTING RESUME (JSON — the facts within are fixed, only summary/skills emphasis/bullet
phrasing may adapt to the new job above):
${JSON.stringify(existing)}
`.trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function retailorResume(
  existing: ResumeContent,
  target: RetailorTarget,
  userId: string
): Promise<ResumeContent> {
  const message = await anthropic.messages.create({
    model: MODEL_BY_FEATURE[FEATURE],
    // Trimmed from 4096 now that the model no longer returns contact, employers, dates,
    // education, referees, or project/role facts - only the tailored summary/skills/tools/
    // bullets need room.
    max_tokens: 2048,
    system: RETAILOR_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(existing, target) }],
  });

  await logApiCost({
    userId,
    feature: FEATURE,
    model: MODEL_BY_FEATURE[FEATURE],
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new RetailorResumeError("Unexpected response type from Claude");
  }

  let tailored: TailoredResumeFields;
  try {
    const parsed: unknown = JSON.parse(extractJson(block.text));
    if (!isPlainObject(parsed)) {
      throw new Error("Parsed JSON is not an object");
    }
    tailored = sanitizeDeep(parsed as unknown as TailoredResumeFields);
  } catch {
    throw new RetailorResumeError("Failed to parse retailored resume JSON from Claude response");
  }

  // Defensive fallback, not just fixed-fact protection: a short/truncated/malformed model
  // response should never silently delete a role's or project's existing bullets, or wipe an
  // existing summary/skills/tools list down to empty. Anything the model didn't return (or
  // returned empty) falls back to what the resume already had, rather than mergeResumeContent's
  // default-to-[]/"" behaviour (correct for fresh generation, where there's no prior content to
  // fall back to, but wrong here). target_titles is deliberately excluded - the system prompt
  // explicitly allows an honest [] there ("return [] if nothing fits well"), so an empty result
  // is a valid answer, not a failure signal.
  const safeExperience = existing.experience.map((source, index) => ({
    bullets:
      tailored.experience?.[index]?.bullets && tailored.experience[index].bullets.length > 0
        ? tailored.experience[index].bullets
        : source.bullets,
  }));
  const safeProjects = existing.projects.map((source, index) => ({
    title: source.title,
    context: source.context,
    year: source.year,
    bullets:
      tailored.projects?.[index]?.bullets && tailored.projects[index].bullets.length > 0
        ? tailored.projects[index].bullets
        : source.bullets,
  }));
  const safeTailored: TailoredResumeFields = {
    ...tailored,
    summary: tailored.summary && tailored.summary.trim().length > 0 ? tailored.summary : existing.summary,
    skills: tailored.skills && tailored.skills.length > 0 ? tailored.skills : existing.skills,
    tools: tailored.tools && tailored.tools.length > 0 ? tailored.tools : existing.tools,
    experience: safeExperience,
    projects: safeProjects,
  };

  return mergeResumeContent(
    safeTailored,
    {
      contact: existing.contact,
      experience: existing.experience.map((source) => ({
        job_title: source.job_title,
        company: source.company,
        location: source.location,
        start_date: source.start_date,
        end_date: source.end_date,
      })),
      education: existing.education,
      referees: existing.referees,
    }
  );
}
