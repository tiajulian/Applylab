import type { PostHog } from "posthog-js";

/**
 * Structured funnel event instrumentation for ApplyLab.
 * Sends events to PostHog (set up in instrumentation-client.ts, live site only) and logs them
 * in development. Payloads carry IDs, counts and labels only: never names, emails or resume text.
 */

export type FunnelEventName =
  | "lead_magnet_page_view"
  | "lead_magnet_resume_uploaded"
  | "lead_magnet_score_rendered"
  | "lead_magnet_signup_gate_viewed"
  | "lead_magnet_account_created"
  | "lead_magnet_upgrade_clicked"
  | "resume_review_page_view"
  | "resume_review_scored"
  | "resume_review_fix_applied"
  | "download_clicked"
  | "sub_modal_shown"
  | "sub_modal_dismissed"
  | "downsell_shown"
  | "downsell_paid"
  | "downsell_dismissed"
  | "template_picker_shown"
  | "template_selected"
  | "template_switched"
  | "panel_opened"
  | "item_accepted"
  | "item_dismissed"
  | "item_reverted"
  | "item_edited"
  | "accept_all_clicked"
  | "upgrade_clicked_from_panel"
  | "add_entry_opened"
  | "add_entry_added"
  | "add_entry_dismissed"
  | "suggest_tasks_opened"
  | "suggest_tasks_added"
  | "suggest_tasks_dismissed"
  | "download_with_open_verify_items"
  | "interview_setup_viewed"
  | "interview_session_started"
  | "interview_fallback_used"
  | "interview_answer_submitted"
  | "interview_submit_failed"
  | "interview_submit_retried"
  | "interview_retry_started"
  | "interview_question_skipped"
  | "interview_ended_early"
  | "interview_report_ready"
  | "interview_report_failed"
  | "interview_practise_weakest_clicked"
  | "interview_free_upgrade_clicked"
  | "interview_story_hint_opened"
  | "interview_upload_resume_clicked"
  | "interview_uploaded_resume_saved"
  | "interview_job_linked_to_tracker"
  | "signup_completed"
  | "resume_generated"
  | "checkout_started"
  | "pro_checkout_completed";

// PostHog loads in the background after the page starts (instrumentation-client.ts), so it
// isn't in every page's bundle. Calls made before then wait here; capped for when it never loads
// (development, or no key configured).
let posthogClient: PostHog | null = null;
const pending: Array<(client: PostHog) => void> = [];
const MAX_PENDING = 50;

export function setAnalyticsClient(client: PostHog): void {
  posthogClient = client;
  for (const call of pending.splice(0)) call(client);
}

function withPostHog(call: (client: PostHog) => void): void {
  if (posthogClient) call(posthogClient);
  else if (pending.length < MAX_PENDING) pending.push(call);
}

export interface FunnelEventPayload {
  score?: number;
  category?: string;
  source?: string;
  plan?: string;
  fileType?: string;
  findingCount?: number;
  [key: string]: unknown;
}

export function trackFunnelEvent(eventName: FunnelEventName, payload?: FunnelEventPayload): void {
  if (typeof window === "undefined") return;

  const eventData = {
    event: eventName,
    timestamp: new Date().toISOString(),
    url: window.location.pathname,
    ...payload,
  };

  // 1. Google Tag Manager / dataLayer if present
  if (Array.isArray((window as any).dataLayer)) {
    (window as any).dataLayer.push(eventData);
  }

  // 2. PostHog
  withPostHog((client) => client.capture(eventName, payload));

  // 3. Development debug logger
  if (process.env.NODE_ENV === "development") {
    console.log(`[Analytics:Funnel] 📊 ${eventName}`, payload ?? {});
  }
}

/** Links this browser's events to the signed-in user, by their anonymous account ID only. */
export function identifyAnalyticsUser(userId: string, properties: { plan: string; is_guest: boolean }): void {
  withPostHog((client) => {
    // Signed into a different account without logging out: start fresh rather than mix the two.
    if (client.get_property("$user_state") === "identified" && client.get_distinct_id() !== userId) client.reset();
    client.identify(userId, properties);
  });
}

/** On log out: later events on this browser must not be credited to the previous user. */
export function resetAnalyticsUser(): void {
  withPostHog((client) => client.reset());
}
