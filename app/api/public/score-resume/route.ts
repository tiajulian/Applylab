import { aiErrorResponse } from "@/lib/aiGateway/errorResponse";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { checkAndRecordRateLimit } from "@/lib/rateLimit";
import { getClientIp, ipRateKey } from "@/lib/security/clientIp";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { extractTextFromFile, MAX_TEXT_LENGTH } from "@/lib/resume/extractText";
import { holdScoreForClaim, releaseHeldScore } from "@/lib/resume/scoreClaim";
import { SCORE_CLAIM_COOKIE, scoreClaimCookieOptions } from "@/lib/resume/scoreClaimCookie";
import { parseProfileFromText, ProfileParseError } from "@/lib/anthropic/parseProfile";
import { parsedProfileToResumeContent } from "@/lib/resume/parsedProfileToResume";
import { resumeReviewHash } from "@/lib/resume/reviewCache";
import { canReuseReview } from "@/lib/resume/reviewAssessment";
import { scoreResumeReview, sanitizeReviewForPlan } from "@/lib/resume/scoreReview";
import type { ResumeReviewFinding, ResumeReviewResult } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

// No account exists for this flow at all, so the IP is the only handle available - tightened
// from 5/hour to 4/24h (spec: "no account at all should only 4 per 24 hours per ip"). Still
// defeated by proxy rotation/shared IPs on its own (see the free-tier-ai-limiting-spec §7/§11 -
// device fingerprinting is the real fix for that, not yet built), but this closes the "just wait
// an hour and go again" gap the old 5/hour window left open.
const IP_RATE_LIMIT_MAX = 4;
const IP_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_SCORE_CAP = 2; // Max 2 free scores per anonymous session
const TEASER_COUNT = 2;
const SEVERITY_RANK: Record<ResumeReviewFinding["severity"], number> = { hard_fail: 0, warning: 1, info: 2 };
const MIN_RESUME_TEXT_LENGTH = 50;

function tooShortResponse() {
  return NextResponse.json(
    { error: "Resume content is too short to analyse. Please provide a complete resume." },
    { status: 400 }
  );
}

export async function POST(request: Request) {
  // Emergency stop (launch runbook): set PAUSE_PUBLIC_SCORER=true in Vercel and redeploy.
  if (process.env.PAUSE_PUBLIC_SCORER === "true") {
    return NextResponse.json(
      { error: "The free resume score is paused for a few minutes. Please try again shortly." },
      { status: 503 }
    );
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient();
    const serviceClient = createServiceRoleClient();

    // Check if an auth session already exists (anonymous or logged in)
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    // Session-based cap check for anonymous visitors
    const currentSessionCount = parseInt(cookieStore.get("anon_score_count")?.value || "0", 10);
    if (!authUser && currentSessionCount >= SESSION_SCORE_CAP) {
      return NextResponse.json(
        {
          error: "Session limit reached. Create a free account to continue scoring resumes.",
          code: "SESSION_CAP_REACHED",
        },
        { status: 429 }
      );
    }

    const clientIp = getClientIp(request.headers) ?? "127.0.0.1";
    const contentType = request.headers.get("content-type") ?? "";
    let file: File | null = null;
    let rawText: string | null = null;
    let turnstileToken: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const upload = formData.get("file");
      turnstileToken = (formData.get("turnstileToken") as string | null) ?? null;
      if (!(upload instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      file = upload;
    } else {
      const body = await request.json();
      turnstileToken = body.turnstileToken ?? null;
      if (!body.rawText || typeof body.rawText !== "string") {
        return NextResponse.json({ error: "rawText is required" }, { status: 400 });
      }
      rawText = body.rawText;
    }

    // Free to check for pasted text, so it's refused before it uses up a captcha or a daily score.
    if (rawText !== null && rawText.trim().length < MIN_RESUME_TEXT_LENGTH) return tooShortResponse();

    // Bot verification via Cloudflare Turnstile. Runs before the file is parsed: parsing an untrusted
    // PDF/DOCX is the expensive, risky step, so every parse costs a solved captcha.
    const isVerified = await verifyTurnstileToken(turnstileToken, clientIp);
    if (!isVerified) {
      return NextResponse.json(
        { error: "Bot verification failed. Please complete the verification and try again." },
        { status: 403 }
      );
    }

    const originalFileName = file?.name ?? null;
    const sourceText = (file ? (await extractTextFromFile(file)).text : rawText ?? "").slice(0, MAX_TEXT_LENGTH).trim();
    if (sourceText.length < MIN_RESUME_TEXT_LENGTH) return tooShortResponse();

    // IP-based abuse rate limiting. After extraction, so an unreadable file doesn't use up a score.
    const ipAllowed = await checkAndRecordRateLimit(
      serviceClient,
      `public-score-ip:${ipRateKey(clientIp)}`,
      IP_RATE_LIMIT_MAX,
      IP_RATE_LIMIT_WINDOW_MS
    );
    if (!ipAllowed) {
      return NextResponse.json(
        { error: "Too many free scores from this network. Please try again tomorrow, or create a free account to keep going." },
        { status: 429 }
      );
    }

    // null for anonymous scorers - api_cost_log.user_id is a uuid, so a placeholder string fails the insert.
    const userIdForCost = authUser?.id ?? null;

    // 1. Parse structured candidate profile from text
    const parsed = await parseProfileFromText(sourceText, userIdForCost);
    const resumeContent = parsedProfileToResumeContent(parsed, sourceText);
    const contentHash = resumeReviewHash(resumeContent);

    // 2. Check if a review already exists for this content hash
    let reviewResult: ResumeReviewResult;
    const { data: cachedResume } = await serviceClient
      .from("resumes")
      .select("id, review_overall_score, review_categories, review_findings, review_content_hash, review_scored_at")
      .eq("review_content_hash", contentHash)
      .not("review_overall_score", "is", null)
      .limit(1)
      .maybeSingle();

    if (
      cachedResume &&
      typeof cachedResume.review_overall_score === "number" &&
      cachedResume.review_categories && canReuseReview(cachedResume.review_categories, false)
    ) {
      reviewResult = {
        overall_score: cachedResume.review_overall_score,
        categories: cachedResume.review_categories,
        findings: cachedResume.review_findings ?? [],
        content_hash: cachedResume.review_content_hash,
        scored_at: cachedResume.review_scored_at,
        unlocked: false,
      };
    } else {
      // 3. Run fresh 5-category scoring in resume-only mode (null job ad)
      reviewResult = await scoreResumeReview(resumeContent, null, userIdForCost, false);
    }

    // 4. Keep the scored resume. A signed-in user gets it in their account now. Anyone else gets it
    // held for 2 days and claimed through the scorer's signup or log-in (lib/resume/scoreClaim.ts).
    // That includes a guest mid-onboarding: guests can't own resumes, and the scorer converts a
    // guest's account in place, so the claim lands in the same account their progress is in.
    const jobTitle = parsed.work_experience?.[0]?.job_title || parsed.fullName || "Imported Resume";
    const companyName = originalFileName ? `Scored from ${originalFileName}` : "Lead Magnet Upload";
    const signedInUser = authUser && !authUser.is_anonymous ? authUser : null;
    const previousClaimToken = cookieStore.get(SCORE_CLAIM_COOKIE)?.value ?? null;
    let savedResumeId: string | null = null;
    let claimToken: string | null = null;
    if (signedInUser) {
      const { data: savedRow, error: saveError } = await serviceClient
        .from("resumes")
        .insert({
          user_id: signedInUser.id,
          job_title: jobTitle,
          company_name: companyName,
          // Required column; a scored resume has no job ad.
          job_description: "",
          resume_content: resumeContent,
          review_overall_score: reviewResult.overall_score,
          review_categories: reviewResult.categories,
          review_findings: reviewResult.findings,
          review_content_hash: reviewResult.content_hash,
          review_scored_at: reviewResult.scored_at,
        })
        .select("id")
        .single();

      if (saveError) console.error("score-resume: failed to save scored resume", saveError);
      savedResumeId = savedRow?.id ?? null;
    } else {
      // Best effort: the visitor still gets their score if holding it fails. One cookie holds one
      // ticket, so the earlier held score (if any) could never be claimed after this one replaces
      // it: dropped alongside, rather than keeping its personal details until it expires.
      const [token] = await Promise.all([
        holdScoreForClaim(serviceClient, { jobTitle, companyName, resumeContent, review: reviewResult }).catch(
          (holdError) => {
            console.error("score-resume: failed to hold score for claiming", holdError);
            return null;
          }
        ),
        previousClaimToken
          ? releaseHeldScore(serviceClient, previousClaimToken).catch((releaseError) =>
              console.error("score-resume: failed to drop the previous held score", releaseError)
            )
          : null,
      ]);
      claimToken = token;
    }

    // Increment session counter in cookie
    const nextCount = currentSessionCount + 1;
    const response = NextResponse.json({
      score: reviewResult.overall_score,
      categories: reviewResult.categories.map((c) => ({
        key: c.key,
        label: c.label,
        score: c.score,
        max_points: c.max_points,
        locked: true,
        finding_count: c.finding_count,
        assessment: c.assessment,
      })),
      totalFindings: reviewResult.findings.length,
      // Titles only (no detail or fix): the blurred teaser behind the signup gate shows this
      // resume's real top findings rather than generic examples.
      teasers: [...reviewResult.findings]
        .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
        .slice(0, TEASER_COUNT)
        .map((f) => ({ severity: f.severity, title: f.title })),
      resumeId: savedResumeId,
      held: Boolean(claimToken),
      contentHash: reviewResult.content_hash,
      candidateName: parsed.fullName || null,
      // Guests too: they need a full account (the scorer's signup) to open the report.
      isAnonymous: !signedInUser,
      // A guest's signup converts their existing (already signed-in) account, with no captcha.
      isGuest: Boolean(authUser?.is_anonymous),
    });

    response.cookies.set("anon_score_count", nextCount.toString(), {
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
      httpOnly: true,
    });
    if (claimToken) {
      response.cookies.set(SCORE_CLAIM_COOKIE, claimToken, scoreClaimCookieOptions);
    } else if (!signedInUser && previousClaimToken) {
      // This score couldn't be held and the earlier one was just dropped, so the old ticket must not
      // claim a different resume than the one just shown. (A signed-in user's ticket is untouched.)
      response.cookies.delete(SCORE_CLAIM_COOKIE);
    }

    return response;
  } catch (error) {
    if (error instanceof ProfileParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const aiRefusal = aiErrorResponse(error);
    if (aiRefusal) return aiRefusal;
    console.error("POST /api/public/score-resume error", error);
    return NextResponse.json({ error: "Failed to analyse resume. Please try again." }, { status: 500 });
  }
}
