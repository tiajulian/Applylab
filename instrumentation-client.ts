import { setAnalyticsClient } from "@/lib/analytics";

// Product analytics (PostHog, EU region). Started on every page, loaded as a separate chunk so
// it doesn't add ~100 kB to every page's first load.
// Live site only, so local and test runs never pollute the numbers. Privacy: no autocapture
// (it would record clicked text, which can be resume content) and no session recording; events
// carry an anonymous user ID and counts/IDs only, never names, emails or resume text.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
// The live site only: local, preview and test runs (even production builds) never send events.
const isLiveSite = typeof window !== "undefined" && ["applylab.io", "www.applylab.io"].includes(window.location.hostname);

/** Removes Stripe's checkout session ID from any URL; it rides on the unlock return URL. */
function withoutSessionId(value: unknown): unknown {
  if (typeof value !== "string" || !value.includes("session_id=")) return value;
  try {
    const url = new URL(value);
    url.searchParams.delete("session_id");
    return url.toString();
  } catch {
    return value.replace(/([?&])session_id=[^&#]*&?/, "$1");
  }
}

function scrubUrls(properties: Record<string, unknown> | undefined): void {
  if (!properties) return;
  for (const [name, value] of Object.entries(properties)) properties[name] = withoutSessionId(value);
}

if (key && isLiveSite) {
  void import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      // Sent through our own domain (proxied in middleware.ts): fewer ad-blocker losses, and the
      // CSP needs no third-party script host.
      api_host: "/ingest",
      ui_host: "https://eu.posthog.com",
      defaults: "2025-05-24",
      person_profiles: "identified_only",
      autocapture: false,
      disable_session_recording: true,
      disable_surveys: true,
      capture_exceptions: true,
      before_send: (event) => {
        if (!event) return event;
        scrubUrls(event.properties);
        scrubUrls(event.$set);
        scrubUrls(event.$set_once);
        scrubUrls(event.properties.$set);
        scrubUrls(event.properties.$set_once);
        // Error reports keep the error type and stack (file and function names), not the message,
        // which can quote resume or job-ad text.
        if (event.event === "$exception" && Array.isArray(event.properties.$exception_list)) {
          for (const entry of event.properties.$exception_list) {
            if (entry && typeof entry === "object") entry.value = "";
          }
          delete event.properties.$exception_message;
        }
        return event;
      },
    });
    setAnalyticsClient(posthog);
  });
}
