import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { extractSkillsFromExperience } from "@/lib/profile/extractSkills";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireUser();

    const body = await request.json().catch(() => ({}));
    const experienceText = typeof body.experienceText === "string" ? body.experienceText : "";

    if (!experienceText.trim()) {
      return NextResponse.json({ skills: [] });
    }

    const skills = await extractSkillsFromExperience(experienceText, authUserId);
    return NextResponse.json({ skills });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("extract-skills error", error);
    return NextResponse.json({ error: "Failed to extract skills" }, { status: 500 });
  }
}
