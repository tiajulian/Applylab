import { aiErrorResponse } from "@/lib/aiGateway/errorResponse";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { generateCoverLetter } from "@/lib/anthropic/generateCoverLetter";
import {
  FreeTierFeatureLimitReachedError,
  freeTierLimitReachedResponse,
  requireUser,
  reserveFreeTierFeature,
  trackFreeTierReservation,
  UnauthorizedError,
} from "@/lib/requireUser";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { getOrParseCompactJobAd } from "@/lib/resume/parsedJobAdCache";
import { checkAndRecordRateLimit } from "@/lib/rateLimit";
import { COVER_LETTER_LENGTHS, COVER_LETTER_LIMITS } from "@/lib/coverLetter/config";
import { blankBody, countWords, defaultTitle, EMPTY_CONTACT, type CoverLetterContent } from "@/lib/coverLetter/content";
import { canCreateLetter } from "@/lib/coverLetter/entitlements";
import { validateCreateInput } from "@/lib/coverLetter/validation";
import { featureDisabledResponse, LETTER_COLUMNS, letterLimitResponse } from "@/lib/coverLetter/server";
import type { Resume } from "@/types";

export const dynamic = "force-dynamic";
// Room for the model call, its one silent retry, and the job-ad parse.
export const maxDuration = 120;

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Cover letter generation timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function GET(request: Request) {
  const disabled = featureDisabledResponse();
  if (disabled) return disabled;

  try {
    const { authUserId } = await requireUser();
    const resumeId = new URL(request.url).searchParams.get("resumeId");

    let query = createClient()
      .from("cover_letters")
      .select(LETTER_COLUMNS)
      .eq("user_id", authUserId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (resumeId) query = query.eq("resume_id", resumeId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ coverLetters: data ?? [] });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const aiRefusal = aiErrorResponse(error);
    if (aiRefusal) return aiRefusal;
    console.error("list cover letters error", error);
    return NextResponse.json({ error: "Failed to load cover letters" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const disabled = featureDisabledResponse();
  if (disabled) return disabled;

  const supabase = createClient();
  const reservation = trackFreeTierReservation("cover-letter");

  try {
    const { authUserId, appUser } = await requireUser();

    const { input, errors } = validateCreateInput(await request.json().catch(() => null));
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Invalid cover letter details", fields: errors }, { status: 400 });
    }
    if (!input.idempotencyKey) {
      return NextResponse.json({ error: "idempotencyKey is required" }, { status: 400 });
    }

    // A retry or double-click of the same request returns the letter it already made, never a second one.
    const { data: existing } = await supabase
      .from("cover_letters")
      .select(LETTER_COLUMNS)
      .eq("user_id", authUserId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) return NextResponse.json({ coverLetter: existing });

    const { count: activeLetters } = await supabase
      .from("cover_letters")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUserId)
      .is("deleted_at", null);
    if (!canCreateLetter(appUser.plan, activeLetters ?? 0)) {
      return letterLimitResponse(COVER_LETTER_LIMITS.freeLetters);
    }

    let resume: Resume | null = null;
    if (input.resumeId) {
      const { data } = await supabase.from("resumes").select("*").eq("id", input.resumeId).eq("user_id", authUserId).maybeSingle();
      resume = (data as Resume | null) ?? null;
      if (!resume) return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    const resumeContent = resume?.resume_content ? sanitizeResumeContent(resume.resume_content) : null;
    const contact = resumeContent?.contact ?? { ...EMPTY_CONTACT, name: appUser.full_name ?? "" };

    let body: string;
    if (input.mode === "blank") {
      body = blankBody(input.hiringManager, contact.name);
    } else {
      if (!resumeContent) {
        return NextResponse.json({ error: "Resume must be generated before creating a cover letter" }, { status: 400 });
      }

      const allowed = await checkAndRecordRateLimit(
        createServiceRoleClient(),
        `cover-letter-v1:${authUserId}`,
        COVER_LETTER_LIMITS.aiPerHour,
        RATE_LIMIT_WINDOW_MS
      );
      if (!allowed) {
        return NextResponse.json({ error: "Cover letter limit reached for now. Try again shortly." }, { status: 429 });
      }

      // Reserved before the model runs and refunded on any failure below: a cancelled or failed
      // generation never costs the user their allowance.
      await reserveFreeTierFeature(supabase, appUser, "cover-letter");
      reservation.markReserved(authUserId);

      const compactJobAd = await getOrParseCompactJobAd(
        input.jobDescription.slice(0, COVER_LETTER_LIMITS.jobDescriptionModelChars),
        authUserId,
        supabase,
        appUser.plan
      );
      const generationInput = {
        compactJobAd,
        jobTitle: input.jobTitle,
        companyName: input.company,
        resumeContent,
        style: {
          tone: input.tone,
          targetWords: COVER_LETTER_LENGTHS[input.length].words,
          language: input.language,
          focus: input.focus,
          hiringManager: input.hiringManager,
        },
      };
      const generate = () =>
        withTimeout(generateCoverLetter(generationInput, authUserId, supabase, appUser.plan), COVER_LETTER_LIMITS.generationTimeoutMs);

      // One silent retry before the user ever sees a failure.
      try {
        body = await generate();
      } catch {
        body = await generate();
      }
      if (!body.trim()) throw new Error("Empty cover letter output");

      // The user cancelled while the model ran: nothing is saved and the allowance is returned.
      if (request.signal.aborted) {
        await reservation.refundIfReserved(supabase);
        return NextResponse.json({ error: "Cancelled" }, { status: 499 });
      }
    }

    const content: CoverLetterContent = { contact, body };
    const { data: created, error: insertError } = await createServiceRoleClient()
      .from("cover_letters")
      .insert({
        user_id: authUserId,
        resume_id: resume?.id ?? null,
        title: defaultTitle(input.jobTitle, input.company),
        job_title: input.jobTitle,
        company: input.company,
        hiring_manager: input.hiringManager,
        job_description: input.jobDescription,
        content,
        language: input.language,
        tone: input.tone,
        length: input.length,
        created_via: input.mode,
        word_count: countWords(body),
        idempotency_key: input.idempotencyKey,
      })
      .select(LETTER_COLUMNS)
      .single();

    if (insertError || !created) {
      await reservation.refundIfReserved(supabase);
      // Lost a race with the same request (unique idempotency key): return the winner.
      if (insertError?.code === "23505") {
        const { data: winner } = await supabase
          .from("cover_letters")
          .select(LETTER_COLUMNS)
          .eq("user_id", authUserId)
          .eq("idempotency_key", input.idempotencyKey)
          .maybeSingle();
        if (winner) return NextResponse.json({ coverLetter: winner });
      }
      return NextResponse.json({ error: "Failed to save cover letter" }, { status: 500 });
    }

    return NextResponse.json({ coverLetter: created }, { status: 201 });
  } catch (error) {
    await reservation.refundIfReserved(supabase);

    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error instanceof FreeTierFeatureLimitReachedError) return freeTierLimitReachedResponse(error);
    const aiRefusal = aiErrorResponse(error);
    if (aiRefusal) return aiRefusal;
    console.error("create cover letter error", error);
    return NextResponse.json({ error: "We couldn't generate your letter." }, { status: 500 });
  }
}
