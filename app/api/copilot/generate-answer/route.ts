import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { generateCopilotAnswer } from "@/lib/gemini/copilot";
import { extensionCorsPreflight, withExtensionCors } from "@/lib/extensionCors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RATE_LIMIT_PER_HOUR = 30;

export async function OPTIONS(request: Request) {
  return extensionCorsPreflight(request);
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireUser(request);
    const body = await request.json().catch(() => ({}));

    const question = typeof body.question === "string" ? body.question.trim().slice(0, 2000) : "";
    const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle.trim().slice(0, 200) : "";
    const jobDescriptionSnippet = typeof body.jobDescriptionSnippet === "string" ? body.jobDescriptionSnippet.trim().slice(0, 3000) : "";
    const format = body.format || "STAR_METHOD";
    const wordLimit = typeof body.wordLimit === "number" ? Math.min(Math.max(body.wordLimit, 50), 300) : 150;

    if (!question) {
      return withExtensionCors(
        NextResponse.json({ error: "question parameter is required" }, { status: 400 }),
        request
      );
    }

    const serviceClient = createServiceRoleClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await serviceClient
      .from("api_cost_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUserId)
      .eq("feature", "copilot")
      .gte("created_at", oneHourAgo);

    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return withExtensionCors(
        NextResponse.json(
          { error: "Copilot answer limit reached for now. Please try again shortly." },
          { status: 429 }
        ),
        request
      );
    }

    const supabase = createClient();
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", authUserId)
      .single();

    const experienceSummary = profile?.work_experience
      ? JSON.stringify(profile.work_experience.slice(0, 3))
      : "Relevant background in software and technology";
    const skills = profile?.skills ? profile.skills.join(", ") : "problem solving, communication";

    const suggestedAnswer = await generateCopilotAnswer(
      { question, jobTitle, jobDescriptionSnippet, format, wordLimit, skills, experienceSummary },
      authUserId
    );

    return withExtensionCors(NextResponse.json({ suggestedAnswer }), request);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return withExtensionCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), request);
    }
    console.error("generate-answer error", error);
    return withExtensionCors(
      NextResponse.json({ error: "Failed to generate AI screening answer" }, { status: 500 }),
      request
    );
  }
}
