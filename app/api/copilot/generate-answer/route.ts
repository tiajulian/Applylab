import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { anthropic, CLAUDE_MODEL_FAST } from "@/lib/anthropic/client";
import { extensionCorsPreflight, withExtensionCors } from "@/lib/extensionCors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function OPTIONS(request: Request) {
  return extensionCorsPreflight(request);
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireUser(request);
    const body = await request.json().catch(() => ({}));

    const question = typeof body.question === "string" ? body.question.trim() : "";
    const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle.trim() : "";
    const jobDescriptionSnippet = typeof body.jobDescriptionSnippet === "string" ? body.jobDescriptionSnippet.trim() : "";
    const format = body.format || "STAR_METHOD";
    const wordLimit = typeof body.wordLimit === "number" ? body.wordLimit : 150;

    if (!question) {
      return withExtensionCors(
        NextResponse.json({ error: "question parameter is required" }, { status: 400 }),
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

    const prompt = `You are an expert Australian job application assistant. Write a high-impact, professional answer to the following screening question for a job application.

Target Job Title: ${jobTitle || "Professional"}
Job Details: ${jobDescriptionSnippet || "Standard Australian corporate / tech role"}
Question: "${question}"

Candidate Skills: ${skills}
Candidate Past Experience: ${experienceSummary}

Format instructions:
- Use the ${format} style.
- Keep the response concise, authoritative, and within ~${wordLimit} words.
- Use Australian English spelling (e.g. key skills, team collaboration, outcomes).
- Output ONLY the final suggested text answer. Do not include markdown meta-commentary, labels, or intros.`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL_FAST,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const suggestedAnswer = response.content[0].type === "text" 
      ? response.content[0].text.trim() 
      : "";

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
