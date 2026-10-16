"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SignupAtGenerateModal } from "@/components/auth/SignupAtGenerateModal";
import { useToast } from "@/components/ui/Toast";

/** What the signup step says, phrased around the action the person just tried. */
export interface AccountGateCopy {
  title: string;
  subtitle?: string;
  submitLabel: string;
}

interface AccountGate {
  /** True for an anonymous onboarding session. Background AI helpers skip themselves for guests. */
  isGuest: boolean;
  /**
   * Call before any AI action someone clicked. Resolves true straight away for a real account;
   * for a guest it opens the signup step and resolves true once they've signed up (so the action
   * carries on by itself), or false if they close it.
   */
  requireAccount: (copy: AccountGateCopy) => Promise<boolean>;
}

// Outside a provider (e.g. a page only real accounts can reach) nothing is gated.
const AccountGateContext = createContext<AccountGate>({ isGuest: false, requireAccount: async () => true });

export const useAccountGate = () => useContext(AccountGateContext);

/**
 * Guests (anonymous onboarding sessions) can answer questions and type their profile, but every
 * AI feature needs a free account - the server enforces that (requirePermanentUser). This shows
 * the one signup step at the moment a guest first asks for AI, then gets out of the way for good.
 */
export function AccountGateProvider({
  children,
  initialIsGuest,
}: {
  children: ReactNode;
  /** What the server already knows for this request, so the very first render is right. */
  initialIsGuest: boolean;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [isGuest, setIsGuest] = useState(initialIsGuest);
  // Mirrors isGuest so requireAccount can stay a stable callback.
  const isGuestRef = useRef(initialIsGuest);
  // `id` remounts the signup form for every ask, so nothing (login mode, an old error, a typed
  // password) carries over from the last one.
  const [request, setRequest] = useState<{ id: number; copy: AccountGateCopy; fullName: string } | null>(null);
  // The open ask's resolver lives in a ref, not state, so settling it is never a side effect
  // inside a state updater.
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    // Fires immediately with the current session and again on sign-in/upgrade, from local
    // storage - no network round trip per check.
    const {
      data: { subscription },
    } = createClient().auth.onAuthStateChange((_event, session) => {
      const guest = Boolean(session?.user.is_anonymous);
      isGuestRef.current = guest;
      setIsGuest(guest);
    });
    return () => subscription.unsubscribe();
  }, []);

  const requireAccount = useCallback(async (copy: AccountGateCopy) => {
    if (!isGuestRef.current) return true; // the common case: a real account, no lookup
    // Guests only: confirm with the server, since a cached session can still say "guest" after
    // they've confirmed their email elsewhere.
    const { data, error } = await createClient().auth.getUser();
    const user = data.user;
    if (error || !user) {
      // Can't tell right now (offline, auth hiccup): don't guess "real account" and let the AI
      // call fail, and don't stop treating them as a guest.
      showToast("Something went wrong. Please try again.", "critical");
      return false;
    }
    if (!user.is_anonymous) {
      isGuestRef.current = false;
      setIsGuest(false);
      return true;
    }

    resolveRef.current?.(false); // a second click while an ask is open replaces it
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setRequest({ id: Date.now(), copy, fullName: (user.user_metadata?.full_name as string | undefined) ?? "" });
    });
  }, [showToast]);

  const finish = useCallback((ok: boolean) => {
    if (ok) {
      isGuestRef.current = false;
      setIsGuest(false);
    }
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setRequest(null);
    resolve?.(ok);
  }, []);

  const handleClose = useCallback(() => finish(false), [finish]);

  const handleSuccess = useCallback(
    async (via: "signup" | "login") => {
      if (via === "login") {
        // They signed into a different, existing account. The guest's half-done work belongs to
        // nobody now, and carrying the action on would write it into that account - so start
        // them fresh in their own dashboard instead.
        finish(false);
        window.location.assign("/dashboard");
        return;
      }
      // Ask the server, not the local session: if the project requires email confirmation, the
      // account stays a guest until the link is clicked, and every AI route would still say no.
      const { data, error } = await createClient().auth.getUser();
      if (error || !data.user || data.user.is_anonymous) {
        finish(false);
        showToast(
          error || !data.user
            ? "Something went wrong. Please try again."
            : "Check your email and click the link to finish creating your account.",
          error || !data.user ? "critical" : "accent"
        );
        return;
      }
      finish(true);
      // Server-rendered bits (plan, free uses left, name in the header) were for the guest.
      router.refresh();
    },
    [finish, router, showToast]
  );

  const value = useMemo(() => ({ isGuest, requireAccount }), [isGuest, requireAccount]);

  return (
    <AccountGateContext.Provider value={value}>
      {children}
      <SignupAtGenerateModal
        key={request?.id}
        isOpen={request !== null}
        onClose={handleClose}
        onSuccess={handleSuccess}
        defaultFullName={request?.fullName}
        badgeText="FREE ACCOUNT"
        title={request?.copy.title}
        subtitle={request?.copy.subtitle}
        submitLabel={request?.copy.submitLabel}
      />
    </AccountGateContext.Provider>
  );
}
