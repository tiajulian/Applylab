import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveVersionSnapshot } from "@/lib/resume/versions";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import type { Resume } from "@/types";

async function loadOwnedResume(supabase: ReturnType<typeof createClient>, resumeId: string) {
  const { data, error } = await supabase.from("resumes").select("*").eq("id", resumeId).single();
  if (error || !data) return null;
  return data as Resume;
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireUser();
    const supabase = createClient();

    const resume = await loadOwnedResume(supabase, params.id);
    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const { data: versions, error } = await supabase
      .from("resume_versions")
      .select("*")
      .eq("resume_id", params.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ versions: versions ?? [] });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("list-versions error", error);
    return NextResponse.json({ error: "Failed to load version history" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireUser();
    const supabase = createClient();

    const resume = await loadOwnedResume(supabase, params.id);
    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    if (!resume.resume_content) {
      return NextResponse.json({ error: "Resume has no content to save" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim().slice(0, 200) : undefined;

    const saved = await saveVersionSnapshot(supabase, params.id, resume.resume_content, label ?? "Manual save");
    if (!saved) {
      return NextResponse.json({ error: "Failed to save version" }, { status: 500 });
    }

    const { data: versions } = await supabase
      .from("resume_versions")
      .select("*")
      .eq("resume_id", params.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ versions: versions ?? [] });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("save-version error", error);
    return NextResponse.json({ error: "Failed to save version" }, { status: 500 });
  }
}
