import Link from "next/link";
import type Stripe from "stripe";
import { notFound } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/jobs/api";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { canExportResume, FREE_RESUME_LIMIT } from "@/lib/requireUser";
import { isPaidResumeUnlock, recordResumeUnlock } from "@/lib/stripe/fulfilment";
import { ResumeWorkspace } from "@/components/resume/ResumeWorkspace";
import { GenerationStepper } from "@/components/resume/GenerationStepper";
import { Button } from "@/components/ui/Button";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { confirmedBridgeItems } from "@/lib/resume/factCheck";
import { fetchBridgeItemsById } from "@/lib/resume/fetchBridgeItems";
import type { ProfileSource } from "@/lib/review/provenance";
import type { Resume } from "@/types";
import { toProfileLibrary } from "@/lib/resume/addEntries";
import { ArrowRightIcon, CheckCircleIcon } from "@/components/ui/icons/LucideIcons";

export const metadata = { title: "Resume editor" };

export default async function ResumeDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ tab?: string; fromGeneration?: string; unlocked?: string; session_id?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  // A non-UUID id can never match a row; skip the query (Postgres would reject it anyway).
  if (!isUuid(params.id)) notFound();

  const user = await getCurrentUser();
  const supabase = createClient();

  const [{ data: resume }, { data: existingApplications }, canExport, { data: profileRow }] = await Promise.all([
    supabase.from("resumes").select("*").eq("id", params.id).single(),
    // limit(1) rather than maybeSingle(): a resume can have more than one linked application
    // (no unique constraint on resume_id), and maybeSingle() errors out on multiple rows.
    supabase.from("applications").select("id").eq("resume_id", params.id).limit(1),
    // Same rule the export routes enforce (Pro, free-allowance resume, or a one-time unlock).
    // A failed lookup shows the locked button rather than crashing the page; the route still decides.
    user?.appUser ? canExportResume(supabase, user.appUser, params.id).catch(() => false) : Promise.resolve(false),
    user?.authUserId
      ? supabase
          .from("user_profiles")
          .select("projects, work_experience, education, referees, skills, tools, raw_linkedin_paste")
          .eq("user_id", user.authUserId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!resume) {
    notFound();
  }

  // What the person confirmed in the skills bridge counts as evidence in the review, so it does not ask again.
  const confirmedBridge = resume.skills_bridge_id ? confirmedBridgeItems(await fetchBridgeItemsById(supabase, resume.skills_bridge_id)) : [];

  const plan = user?.appUser?.plan ?? "free";
  let isResumeUnlocked = canExport;
  // Back from Stripe before the webhook landed: check the session with Stripe and grant it now.
  if (!isResumeUnlocked && searchParams?.session_id && user?.authUserId) {
    isResumeUnlocked = await unlockFromCheckoutReturn(searchParams.session_id, user.authUserId, params.id);
  }
  // General mode is the only path that saves no job ad (tailored generation requires one); the
  // title isn't a safe signal, since a tailored resume can be saved with an empty one.
  const isGeneral = !resume.job_description?.trim();
  // Only offer "Tailor to a job ad" when it can actually run, not as a path into the Go Pro panel.
  const canMakeAnother = plan !== "free" || (user?.appUser?.resumes_used ?? 0) < FREE_RESUME_LIMIT;
  // resume_content is stored as jsonb, so a row from before a ResumeContent schema change simply
  // won't have the newer fields - normalize it here rather than let the editor/templates crash
  // on target_titles/tools/projects being undefined instead of an empty array.
  const resumeRow: Resume = {
    ...(resume as Resume),
    resume_content: resume.resume_content ? sanitizeResumeContent(resume.resume_content) : null,
  };

  return (
    <div className="flex flex-col gap-4">
      {searchParams?.fromGeneration === "1" && (
        <div className="flex flex-col gap-4">
          {/* The job-ad steps don't apply to a general resume, which never had an ad. */}
          {!isGeneral && <GenerationStepper currentStep={3} />}
          <div
            className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent-soft/40 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              <div>
                <p className="text-[15px] font-semibold text-ink">Your resume is ready</p>
                <p className="text-sm text-ink-secondary">
                  Edit it below, or score it out of 100 across 5 areas, including how easily hiring software (ATS) can read it.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
              {isGeneral && canMakeAnother && (
                <Link
                  href="/resume/new"
                  className="text-sm font-medium text-accent-hover underline underline-offset-4 hover:text-accent"
                >
                  Tailor to a job ad
                </Link>
              )}
              <Button href={`/resume/${resumeRow.id}/review`} size="sm">
                View AI review <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <ResumeWorkspace
        resume={resumeRow}
        profileLibrary={toProfileLibrary(profileRow)}
        profile={profileRow ? ({ ...profileRow, confirmed_bridge: confirmedBridge } as unknown as ProfileSource) : null}
        isPaidPlan={plan !== "free"}
        isResumeUnlocked={isResumeUnlocked}
        isInitiallyUnlockedNotification={searchParams?.unlocked === "1"}
        isTrackedInitially={(existingApplications?.length ?? 0) > 0}
        initialTab={searchParams?.tab === "cover-letter" ? "cover-letter" : "resume"}
      />
    </div>
  );
}

/** Grants the unlock from a Stripe checkout return, if that session is this user's paid unlock of this resume. */
async function unlockFromCheckoutReturn(sessionId: string, authUserId: string, resumeId: string): Promise<boolean> {
  try {
    // Loaded only on a checkout return, so the editor doesn't pull in Stripe on every visit.
    const { stripe } = await import("@/lib/stripe/client");
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.latest_charge"] });
    const owner = session.metadata?.userId ?? session.client_reference_id;
    if (owner !== authUserId || session.metadata?.resumeId !== resumeId || !isPaidResumeUnlock(session)) return false;
    // An old return link must not bring back an unlock that was refunded since.
    const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;
    const charge = paymentIntent?.latest_charge as Stripe.Charge | null | undefined;
    if (charge?.refunded) return false;
    const { error } = await recordResumeUnlock(createServiceRoleClient(), session);
    if (error) console.error("checkout return: failed to record resume unlock", error);
    return !error;
  } catch (error) {
    // A bad or foreign session id, or Stripe being down: the webhook still grants the unlock.
    console.error("checkout return: could not verify session", error);
    return false;
  }
}
