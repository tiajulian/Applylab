import "@/lib/pdf/domPolyfills";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { checkAndRecordRateLimit } from "@/lib/rateLimit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { parseProfileFromText, ProfileParseError } from "@/lib/anthropic/parseProfile";
import { parsedProfileToResumeContent } from "@/lib/resume/parsedProfileToResume";
import { hashForScoring } from "@/lib/resume/scoreCache";
import { scoreResumeReview, sanitizeReviewForPlan } from "@/lib/resume/scoreReview";
import type { ResumeReviewResult } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_TEXT_LENGTH = 50_000;
const IP_RATE_LIMIT_MAX = 5;
const IP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SESSION_SCORE_CAP = 2; // Max 2 free scores per anonymous session

async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ProfileParseError("File is too large. Please upload a PDF or Word doc under 5 MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (
    name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new ProfileParseError("Unsupported file type. Please upload a PDF or Word document (.docx).");
}

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
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

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const contentType = request.headers.get("content-type") ?? "";
    let sourceText: string;
    let turnstileToken: string | null = null;
    let originalFileName: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      turnstileToken = (formData.get("turnstileToken") as string | null) ?? null;
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      originalFileName = file.name;
      sourceText = await extractTextFromFile(file);
    } else {
      const body = await request.json();
      turnstileToken = body.turnstileToken ?? null;
      if (!body.rawText || typeof body.rawText !== "string") {
        return NextResponse.json({ error: "rawText is required" }, { status: 400 });
      }
      sourceText = body.rawText;
    }

    sourceText = sourceText.slice(0, MAX_TEXT_LENGTH).trim();
    if (sourceText.length < 50) {
      return NextResponse.json(
        { error: "Resume content is too short to analyze. Please provide a complete resume." },
        { status: 400 }
      );
    }

    // Bot verification via Cloudflare Turnstile
    const isVerified = await verifyTurnstileToken(turnstileToken, clientIp);
    if (!isVerified) {
      return NextResponse.json(
        { error: "Bot verification failed. Please complete the verification and try again." },
        { status: 403 }
      );
    }

    // IP-based abuse rate limiting
    const ipAllowed = await checkAndRecordRateLimit(
      serviceClient,
      `public-score-ip:${clientIp}`,
      IP_RATE_LIMIT_MAX,
      IP_RATE_LIMIT_WINDOW_MS
    );
    if (!ipAllowed) {
      return NextResponse.json(
        { error: "Too many requests from this IP. Please try again in an hour." },
        { status: 429 }
      );
    }

    const userIdForCost = authUser?.id || "anonymous-lead-magnet";

    // 1. Parse structured candidate profile from text
    const parsed = await parseProfileFromText(sourceText, userIdForCost);
    const resumeContent = parsedProfileToResumeContent(parsed, sourceText);
    const contentHash = hashForScoring(JSON.stringify(resumeContent));

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
      cachedResume.review_categories
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

    // 4. If an authenticated user (or anonymous Supabase session) is active, persist the resume
    let savedResumeId: string | null = null;
    if (authUser) {
      const jobTitle = parsed.work_experience?.[0]?.job_title || parsed.fullName || "Imported Resume";
      const { data: savedRow } = await serviceClient
        .from("resumes")
        .insert({
          user_id: authUser.id,
          job_title: jobTitle,
          company_name: originalFileName ? `Scored from ${originalFileName}` : "Lead Magnet Upload",
          resume_content: resumeContent,
          review_overall_score: reviewResult.overall_score,
          review_categories: reviewResult.categories,
          review_findings: reviewResult.findings,
          review_content_hash: reviewResult.content_hash,
          review_scored_at: reviewResult.scored_at,
        })
        .select("id")
        .single();

      if (savedRow) {
        savedResumeId = savedRow.id;
      }
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
      })),
      totalFindings: reviewResult.findings.length,
      resumeId: savedResumeId,
      contentHash: reviewResult.content_hash,
      candidateName: parsed.fullName || null,
      isAnonymous: !authUser,
    });

    response.cookies.set("anon_score_count", nextCount.toString(), {
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
      httpOnly: true,
    });

    return response;
  } catch (error) {
    if (error instanceof ProfileParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/public/score-resume error", error);
    return NextResponse.json({ error: "Failed to analyze resume. Please try again." }, { status: 500 });
  }
}
