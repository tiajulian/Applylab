import { FREE_INTERVIEW_ALLOWANCE } from "@/lib/interview/setupConstants";
import type { AppUser } from "@/types";

/** Free practices still available (Infinity for Pro). Client-safe; the server re-checks
 *  atomically in lib/interview/allowance.ts. */
export const freePracticesLeft = (appUser: Pick<AppUser, "plan" | "free_interviews_used">) =>
  appUser.plan === "free" ? Math.max(0, FREE_INTERVIEW_ALLOWANCE.count - (appUser.free_interviews_used ?? 0)) : Infinity;
