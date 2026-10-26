import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError, unauthorizedResponse } from "@/lib/requireUser";
import { MAX_UPLOADED_RESUME_NAME } from "@/lib/interview/uploadedResume";

export const dynamic = "force-dynamic";

// Rename and delete stay open on every plan, so someone who stops paying can still clean up.

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { authUserId } = await requireUser();
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_UPLOADED_RESUME_NAME) : "";
    if (!name) return NextResponse.json({ error: "Give the resume a name" }, { status: 400 });

    const { data, error } = await createClient()
      .from("uploaded_resumes")
      .update({ name })
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .select("id, name, source, created_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    return NextResponse.json({ resume: data });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorizedResponse(error);
    console.error("rename uploaded resume error", error);
    return NextResponse.json({ error: "Failed to rename the resume" }, { status: 500 });
  }
}

/** Practice sessions from this resume are kept (their job details live on the session). */
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { authUserId } = await requireUser();
    const { data, error } = await createClient()
      .from("uploaded_resumes")
      .delete()
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorizedResponse(error);
    console.error("delete uploaded resume error", error);
    return NextResponse.json({ error: "Failed to delete the resume" }, { status: 500 });
  }
}
