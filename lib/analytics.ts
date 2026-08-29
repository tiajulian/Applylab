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
  | "resume_review_fix_applied";

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
