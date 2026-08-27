import { anthropic } from "@/lib/anthropic/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";
import { formatEnAuDate } from "@/lib/dateUtils";
import type { InterviewStageType } from "@/types";

const FEATURE = "followup_draft" as const;

export interface FollowupDraftInput {
  candidateName: string;
  companyName: string;
  jobTitle: string;
  appliedDate?: string | null;
  interviews?: Array<{
    stage_type: InterviewStageType;
    interviewers?: string | null;
    scheduled_at?: string;
    outcome?: string;
  }>;
  reason?: "post_applied" | "post_interview" | "general";
}

export interface FollowupDraftResult {
  subject: string;
  body: string;
  model: string;
}

const SYSTEM_PROMPT = `
You write polite, concise Australian-style job application follow-up emails.

Anti-hallucination invariants (non-negotiable):
1. Use ONLY confirmed facts provided in the input prompt (candidate name, company name, role title, applied date, completed interview details).
2. NEVER invent recruiter names, phone numbers, dates, reference numbers, or requirements not in the prompt.
3. If no recipient name is provided, use "Hi Hiring Team," or "Dear Hiring Manager,".
4. Tone: Australian professional - respectful, direct, warm, concise, and never pushy or presumptuous.
5. Punctuation: NEVER use em dashes (—) or en dashes (–). Use standard hyphens (-) or commas.
6. Length: 2 short paragraphs (approximately 80-120 words total), plus greeting and sign-off.
7. Return strictly a JSON object with two fields:
   - "subject": concise subject line (e.g. "Following up on Senior Business Analyst application - [Candidate Name]")
   - "body": the email body text with paragraph breaks.
`;

export async function generateFollowupDraft(
  input: FollowupDraftInput,
  userId: string
): Promise<FollowupDraftResult> {
  const modelConfig = MODEL_BY_FEATURE[FEATURE];

  const appliedDateFormatted = input.appliedDate
    ? formatEnAuDate(input.appliedDate)
    : "recently";

  let interviewContext = "";
  if (input.interviews && input.interviews.length > 0) {
    const rounds = input.interviews
      .map((i) => {
        const dateStr = i.scheduled_at ? ` on ${formatEnAuDate(i.scheduled_at)}` : "";
        const who = i.interviewers ? ` with ${i.interviewers}` : "";
        return `- ${i.stage_type.replace(/_/g, " ")}${dateStr}${who} (outcome: ${i.outcome ?? "completed"})`;
      })
      .join("\n");
    interviewContext = `\nINTERVIEW HISTORY:\n${rounds}`;
  }

  const prompt = `
CANDIDATE NAME: ${input.candidateName || "The Applicant"}
COMPANY: ${input.companyName}
ROLE: ${input.jobTitle}
APPLIED DATE: ${appliedDateFormatted}
REASON: ${input.reason ?? "post_applied"}
${interviewContext}

Please generate a professional follow-up email adhering to all anti-hallucination rules. Output JSON only.
`;

  const response = await anthropic.messages.create({
    model: modelConfig.model,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  await logApiCost({
    userId,
    feature: FEATURE,
    provider: modelConfig.provider,
    model: modelConfig.model,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const rawText = textBlock ? textBlock.text : "";

  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { subject?: string; body?: string };
      return {
        subject: parsed.subject ? parsed.subject.replace(/[—–]/g, " - ") : `Following up on ${input.jobTitle} application - ${input.candidateName}`,
        body: parsed.body ? parsed.body.replace(/[—–]/g, " - ") : rawText.replace(/[—–]/g, " - "),
        model: modelConfig.model,
      };
    }
  } catch {
    // fallback
  }

  return {
    subject: `Following up on ${input.jobTitle} application - ${input.candidateName}`,
    body: (rawText || `Hi Hiring Team,\n\nI am writing to follow up on my application for the ${input.jobTitle} role at ${input.companyName}.\n\nKind regards,\n${input.candidateName}`).replace(/[—–]/g, " - "),
    model: modelConfig.model,
  };
}
