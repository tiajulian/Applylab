import { PaidFeatureError } from "@/lib/requireUser";
import { FREE_INTERVIEW_ALLOWANCE } from "@/lib/interview/setupConstants";
import type { createServiceRoleClient } from "@/lib/supabase/server";
import type { AppUser, InterviewSession } from "@/types";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

/** Free plan and its one practice is already used. */
export class FreeInterviewUsedError extends Error {}

export const isFreePlan = (appUser: Pick<AppUser, "plan">) => appUser.plan === "free";

export { freePracticesLeft } from "@/lib/interview/allowanceClient";

/**
 * Pro can use every session. Free can use only its own free-allowance session (set by the server
 * when that session was created), so a free account can't reach a session it never had access to,
 * e.g. one left over from a lapsed Pro subscription.
 */
export function assertSessionAccess(appUser: Pick<AppUser, "plan">, session: Pick<InterviewSession, "is_free_allowance">) {
  if (isFreePlan(appUser) && !session.is_free_allowance) {
    throw new PaidFeatureError("This interview practice needs Pro");
  }
}

/**
 * Takes one free practice for this user, atomically: the count only goes up from the value read,
 * so two tabs starting at once can't both get one. Counted on the user row (server-written), not
 * by counting sessions, so deleting the session doesn't give the practice back.
 */
export async function claimFreePractice(serviceClient: ServiceClient, appUser: Pick<AppUser, "id" | "free_interviews_used">) {
  const used = appUser.free_interviews_used ?? 0;
  if (used >= FREE_INTERVIEW_ALLOWANCE.count) throw new FreeInterviewUsedError();
  const { data } = await serviceClient
    .from("users")
    .update({ free_interviews_used: used + 1 })
    .eq("id", appUser.id)
    .eq("free_interviews_used", used)
    .select("id")
    .maybeSingle();
  if (!data) throw new FreeInterviewUsedError();
}

/** Gives the practice back when the session couldn't be created after all. */
export async function refundFreePractice(serviceClient: ServiceClient, appUser: Pick<AppUser, "id" | "free_interviews_used">) {
  const used = (appUser.free_interviews_used ?? 0) + 1;
  await serviceClient.from("users").update({ free_interviews_used: used - 1 }).eq("id", appUser.id).eq("free_interviews_used", used);
}
