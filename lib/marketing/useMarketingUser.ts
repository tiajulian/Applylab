"use client";

import { useEffect, useState } from "react";
import type { UserMenuProps } from "@/components/dashboard/UserAvatarMenu";

// Module-level, not per-hook-instance: several components on the same marketing page
// (MarketingHeader, plus PricingView/PublicResumeScorer's own login-gated logic) each call this
// hook independently. Without a shared cache they'd each fire their own GET /api/marketing/session
// on mount; sharing one in-flight promise means the page only ever makes that request once.
//
// Cleared once it settles (not kept forever) - login/logout (app/(auth)/login/page.tsx,
// components/ui/LogoutButton.tsx) both use router.push() + router.refresh(), a client-side/SPA
// navigation that does NOT reset this module's state. A cache that lived forever would keep
// answering with whoever was logged in (or out) the first time any marketing page's header
// mounted for the rest of the tab's session - e.g. log in, then soft-navigate to /pricing, and
// the header would still show "Log in" and handleStartPro would incorrectly bounce you back to
// /login. Clearing it after resolution means every fresh mount (which is what a navigation to
// another marketing page produces) re-checks, while calls that land while one is already in
// flight still share that single request.
let sessionPromise: Promise<UserMenuProps | null> | null = null;

function fetchMarketingUser(): Promise<UserMenuProps | null> {
  if (!sessionPromise) {
    sessionPromise = fetch("/api/marketing/session")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => (data.user as UserMenuProps | null) ?? null)
      .catch(() => null)
      .finally(() => {
        sessionPromise = null;
      });
  }
  return sessionPromise;
}

/**
 * Client-side replacement for a marketing page's old `const user = await getCurrentUser()` -
 * fetched from /api/marketing/session instead of being resolved server-side, so the page itself
 * no longer needs headers()/cookies() and can be statically served. `user` starts null (the
 * logged-out state, which is what the overwhelming majority of marketing-page visitors are, and
 * what the static HTML already shows before this resolves) and updates in place once the fetch
 * resolves - so an already-logged-in visitor sees the header's CTA swap to their avatar menu a
 * moment after first paint, rather than it being present immediately.
 */
export function useMarketingUser(): { user: UserMenuProps | null; isLoading: boolean } {
  const [user, setUser] = useState<UserMenuProps | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchMarketingUser().then((resolved) => {
      if (cancelled) return;
      setUser(resolved);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, isLoading };
}
