import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { COVER_LETTER_LIMITS } from "@/lib/coverLetter/config";
import { countWords, parseContent } from "@/lib/coverLetter/content";
import { LETTER_COLUMNS } from "@/lib/coverLetter/server";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

function errorResponse(error: unknown, action: string) {
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  console.error(`${action} cover letter error`, error);
  return NextResponse.json({ error: `Failed to ${action} cover letter` }, { status: 500 });
}

async function fetchOwnLetter(id: string, userId: string) {
  return createClient()
    .from("cover_letters")
    .select(LETTER_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { authUserId } = await requireUser();
    const { data } = await fetchOwnLetter(params.id, authUserId);
    if (!data) return NextResponse.json({ error: "Cover letter not found" }, { status: 404 });
    return NextResponse.json({ coverLetter: data });
  } catch (error) {
    return errorResponse(error, "load");
  }
}

/**
 * Autosave. `expectedUpdatedAt` is the row version the editor last saw; if another tab has saved since,
 * nothing is written and the client is told to reload rather than silently overwriting the newer text.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { authUserId } = await requireUser();
    const body = await request.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : undefined;
    const letterBody = typeof body?.body === "string" ? body.body : undefined;
    const expectedUpdatedAt = typeof body?.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : null;

    if (title === undefined && letterBody === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    if (title !== undefined && (!title || title.length > COVER_LETTER_LIMITS.titleMax)) {
      return NextResponse.json({ error: "Please enter a title." }, { status: 400 });
    }
    if (letterBody !== undefined && letterBody.length > COVER_LETTER_LIMITS.bodyMax) {
      return NextResponse.json({ error: "This letter is too long to save." }, { status: 400 });
    }

    const { data: current } = await fetchOwnLetter(params.id, authUserId);
    if (!current) return NextResponse.json({ error: "Cover letter not found" }, { status: 404 });
    if (expectedUpdatedAt && current.updated_at !== expectedUpdatedAt) {
      return NextResponse.json({ error: "This letter was updated in another tab. Reload?", code: "CONFLICT" }, { status: 409 });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) update.title = title;
    if (letterBody !== undefined) {
      update.content = { ...parseContent(current.content), body: letterBody };
      update.word_count = countWords(letterBody);
    }

    // Matching on updated_at makes the check-and-write atomic: a save that lost the race updates zero rows.
    const { data: saved, error } = await createClient()
      .from("cover_letters")
      .update(update)
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .eq("updated_at", current.updated_at)
      .select("updated_at")
      .maybeSingle();
    if (error) throw error;
    if (!saved) {
      return NextResponse.json({ error: "This letter was updated in another tab. Reload?", code: "CONFLICT" }, { status: 409 });
    }
    return NextResponse.json({ updatedAt: saved.updated_at });
  } catch (error) {
    return errorResponse(error, "save");
  }
}

/** Soft delete: the row stays (recoverable by support) but drops out of every list and the free-tier count. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { authUserId } = await requireUser();
    const { data, error } = await createClient()
      .from("cover_letters")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Cover letter not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "delete");
  }
}
