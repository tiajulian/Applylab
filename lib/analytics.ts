/**
 * Structured funnel event instrumentation for ApplyLab.
 * Emits events to window/dataLayer/telemetry when available and logs in development.
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
  | "interview_job_linked_to_tracker";



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

  // 2. Plausible / PostHog / generic analytics if initialized
  if (typeof (window as any).plausible === "function") {
    (window as any).plausible(eventName, { props: payload });
  }

  // 3. Development debug logger
  if (process.env.NODE_ENV === "development") {
    console.log(`[Analytics:Funnel] 📊 ${eventName}`, payload ?? {});
  }
}
