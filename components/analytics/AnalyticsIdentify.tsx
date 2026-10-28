"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { identifyAnalyticsUser, trackFunnelEvent, type FunnelEventName } from "@/lib/analytics";

const DAY_MS = 24 * 60 * 60_000;

/** Fires an event once per browser tab for this key, so a reload doesn't count it twice. */
function trackOnce(key: string, eventName: FunnelEventName, payload?: Record<string, unknown>): void {
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // Storage blocked (private mode): a rare double count beats losing the event.
  }
  trackFunnelEvent(eventName, payload);
}

/**
 * Links analytics to the signed-in user (by account ID only) and records the funnel steps that
 * are only visible from where a flow lands: a new account, a freshly generated resume, and a
 * return from a paid Pro checkout. Mounted once in the dashboard layout.
 */
export function AnalyticsIdentify({
  userId,
  plan,
  isGuest,
  createdAt,
}: {
  userId: string;
  plan: string;
  isGuest: boolean;
  createdAt: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    identifyAnalyticsUser(userId, { plan, is_guest: isGuest });
    // A real (non-guest) account seen within a day of being created: counted once per user and browser.
    if (!isGuest && createdAt && Date.now() - new Date(createdAt).getTime() < DAY_MS) {
      try {
        if (!localStorage.getItem(`al_signup_${userId}`)) {
          localStorage.setItem(`al_signup_${userId}`, "1");
          trackFunnelEvent("signup_completed");
        }
      } catch {
        // Storage blocked: skip rather than count the signup on every page.
      }
    }
  }, [userId, plan, isGuest, createdAt]);

  useEffect(() => {
    // Stripe sends people to the success URL once checkout completes (a bank debit may still be
    // clearing). The flag is then dropped so a reload or a history visit can't count it again.
    if (pathname === "/dashboard" && searchParams.get("upgraded") === "1") {
      trackOnce(`al_upgraded_${userId}`, "pro_checkout_completed", { plan: "pro" });
      const rest = new URLSearchParams(searchParams);
      rest.delete("upgraded");
      router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false });
    }
    if (pathname.startsWith("/resume/") && searchParams.get("fromGeneration") === "1") {
      trackOnce(`al_generated_${pathname}`, "resume_generated", { resumeId: pathname.split("/")[2] });
    }
  }, [pathname, searchParams, userId, router]);

  return null;
}
