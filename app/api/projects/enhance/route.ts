import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { anthropic } from "@/lib/anthropic/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const FEATURE = "project-enhance" as const;
const RATE_LIMIT_PER_HOUR = 15;

export interface ProjectEnhanceRequest {
  title: string;
  role?: string;
  context?: string;
  stack?: string[];
  tools?: string[];
  notes?: string;
  isCurrent?: boolean;
  paceAnswers?: {
    problem?: string;
    architecture?: string;
    constraint?: string;
    evidence?: string;
  };
}

export interface ProjectEnhanceResponse {
  architectureFirst: string[];
  impactFirst: string[];
  concise: string[];
}

const SYSTEM_PROMPT = `
You are a senior tech recruiter and elite resume writer for the Australian job market.
Your task is to transform raw project details into recruiter-grade, high-impact bullet points using the P-A-C-E Framework (Problem, Architecture, Constraint, Evidence).

Rules:
1. P-A-C-E FRAMEWORK:
   - Problem: What real-world bottleneck, challenge, or user need was addressed?
   - Architecture: What architectural patterns, tools, and technical decisions were implemented?
   - Constraint: What engineering challenge, trade-off, concurrency, cost, or downtime constraint was managed?
   - Evidence: What technical metrics (latency, query speed %, throughput, uptime %, active users) demonstrate success?

2. STRICT ANTI-TUTORIAL BAN:
   - Never use passive, weak, or novice phrasing such as "Created a basic app", "Worked on a tutorial", "Learned React", "Built a simple website", or "Helped with".
   - Use strong technical action verbs: "Architected", "Engineered", "Spearheaded", "Optimised", "Deployed", "Centralised", "Integrated".

3. WEAVE TECH STACK INTO ACTIONS:
   - Directly weave the provided technologies/frameworks into action sentences (e.g. "Engineered a distributed telemetry pipeline using Python, Kafka, and Redis...").

4. TECHNICAL METRICS:
   - If business/revenue figures are absent, inject realistic engineering benchmarks (e.g., "sub-200ms API response time", "40% reduction in query execution time", "processed 50k+ daily records", "maintained 99.9% uptime").

5. TENSE & AUSTRALIAN ENGLISH:
   - Use present tense if current/ongoing; past tense if completed.
   - Strictly use Australian English spelling ("optimised", "centralised", "prioritised", "customised").

6. PUNCTUATION & DASHES (STRICT):
   - Strictly NEVER use em dashes (—) or en dashes (–). Use commas, semicolons, hyphens, or standard punctuation instead.

Return ONLY valid JSON matching this exact structure:
{
  "architectureFirst": [
    "String bullet 1 focusing on technical depth and system design",
    "String bullet 2 focusing on infrastructure and data architecture"
  ],
  "impactFirst": [
    "String bullet 1 front-loading performance gains and user/process outcomes",
    "String bullet 2 front-loading automation and operational cost reductions"
  ],
  "concise": [
    "String bullet 1 high-density 1-line version optimized for 1-page limits",
    "String bullet 2 high-density 1-line version optimized for 1-page limits"
  ]
}
No Markdown backticks, no preamble, no prose outside JSON.
`;

function safeJsonParse<T>(rawText: string): T | null {
  try {
    const cleaned = extractJson(rawText)
      .replace(/,\s*([\]}])/g, "$1") // Clean trailing commas
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); // Strip illegal control characters
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireUser();

    let body: ProjectEnhanceRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const title = body.title?.trim() || "";
    const role = body.role?.trim() || body.context?.trim() || "Developer / Architect";
    const stackList = body.stack && body.stack.length > 0 ? body.stack : body.tools || [];
    const stackText = stackList.join(", ") || "General Stack";
    const isCurrent = Boolean(body.isCurrent);
    const rawNotes = body.notes?.trim() || "";

    const problem = body.paceAnswers?.problem?.trim() || "";
    const architecture = body.paceAnswers?.architecture?.trim() || "";
    const constraint = body.paceAnswers?.constraint?.trim() || "";
    const evidence = body.paceAnswers?.evidence?.trim() || "";

    // Validation: Require at least a title or raw notes/pace input
    if (!title && !rawNotes && !problem && !architecture) {
      return NextResponse.json(
        { error: "Please provide a project name or project details to enhance." },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("api_cost_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUserId)
      .eq("feature", FEATURE)
      .gte("created_at", oneHourAgo);

    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json(
        { error: "Project enhance limit reached for now. Please try again shortly." },
        { status: 429 }
      );
    }

    const userContent = `
Project Title: ${title || "Software Engineering Project"}
Role/Contribution: ${role}
Technologies/Stack: ${stackText}
Status: ${isCurrent ? "Current / Ongoing" : "Completed"}
Raw Notes: ${rawNotes || "N/A"}

P-A-C-E Framework Inputs:
- Problem: ${problem || "Raw data processing bottleneck or manual user flow"}
- Architecture/Stack choices: ${architecture || stackText}
- Engineering Constraint: ${constraint || "Concurrency, latency, or resource constraint"}
- Evidence / Technical Metric: ${evidence || "Measurable performance or response time improvement"}
`;

    const { provider, model } = MODEL_BY_FEATURE[FEATURE];

    const message = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    await logApiCost({
      userId: authUserId,
      feature: FEATURE,
      provider,
      model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    });

    const block = message.content[0];
    if (block.type !== "text") {
      return NextResponse.json({ error: "Unexpected response from Claude" }, { status: 500 });
    }

    const parsed = safeJsonParse<ProjectEnhanceResponse>(block.text);

    if (!parsed) {
      return NextResponse.json(
        { error: "Could not parse AI response. Please try again." },
        { status: 500 }
      );
    }

    const sanitized = sanitizeDeep(parsed);

    return NextResponse.json({
      architectureFirst: Array.isArray(sanitized.architectureFirst) ? sanitized.architectureFirst : [],
      impactFirst: Array.isArray(sanitized.impactFirst) ? sanitized.impactFirst : [],
      concise: Array.isArray(sanitized.concise) ? sanitized.concise : [],
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("project enhance error:", error);
    return NextResponse.json({ error: "Failed to enhance project bullets" }, { status: 500 });
  }
}
