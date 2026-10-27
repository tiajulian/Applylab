import { createHash, randomBytes } from "node:crypto";
import type { createServiceRoleClient } from "@/lib/supabase/server";
import type { ResumeContent, ResumeReviewResult } from "@/types";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

// The cookie name, path and options live in scoreClaimCookie.ts (edge-safe, for middleware).

/** Only this is stored, so a copy of the table can't be used to claim a score. */
export function hashClaimToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Holds a scored resume for later claiming and returns the token to put in the cookie. */
export async function holdScoreForClaim(
  service: ServiceClient,
  score: { jobTitle: string; companyName: string; resumeContent: ResumeContent; review: ResumeReviewResult }
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const { error } = await service.from("pending_resume_scores").insert({
    claim_hash: hashClaimToken(token),
    job_title: score.jobTitle,
    company_name: score.companyName,
    resume_content: score.resumeContent,
    review_overall_score: score.review.overall_score,
    review_categories: score.review.categories,
    review_findings: score.review.findings,
    review_content_hash: score.review.content_hash,
    review_scored_at: score.review.scored_at,
  });
  if (error) throw error;
  return token;
}

/** Deletes a held score that can no longer be claimed (the visitor has since scored another). */
export async function releaseHeldScore(service: ServiceClient, token: string): Promise<void> {
  const { error } = await service.from("pending_resume_scores").delete().eq("claim_hash", hashClaimToken(token));
  if (error) throw error;
}

/** Turns a held score into a resume owned by userId. Null if the token is unknown, used or expired. */
export async function claimHeldScore(service: ServiceClient, token: string, userId: string): Promise<string | null> {
  const { data, error } = await service.rpc("claim_pending_resume_score", {
    p_claim_hash: hashClaimToken(token),
    p_user_id: userId,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}
