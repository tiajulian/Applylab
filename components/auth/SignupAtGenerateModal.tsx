"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { GoogleIcon } from "@/components/ui/icons/GoogleIcon";
import { Input } from "@/components/ui/Input";
import { TERMS_VERSION } from "@/lib/terms";

interface SignupAtGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultFullName?: string;
}

export function SignupAtGenerateModal({
  isOpen,
  onClose,
  onSuccess,
  defaultFullName = "",
}: SignupAtGenerateModalProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(defaultFullName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCollision, setIsCollision] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    if (defaultFullName && !fullName) {
      setFullName(defaultFullName);
    }
  }, [defaultFullName, fullName]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleEmailSignup(event: React.FormEvent) {
    event.preventDefault();
    if (!agreedToTerms) return;
    setError(null);
    setIsCollision(false);
    setIsLoading(true);

    const supabase = createClient();

    // Convert the anonymous user to a permanent email/password user
    const { error: updateError } = await supabase.auth.updateUser({
      email,
      password,
      data: { full_name: fullName, accepted_terms_version: TERMS_VERSION },
    });

    if (updateError) {
      setIsLoading(false);
      const msg = updateError.message.toLowerCase();
      if (
        msg.includes("already registered") ||
        msg.includes("email exists") ||
        msg.includes("already in use") ||
        msg.includes("user already registered")
      ) {
        setIsCollision(true);
        setError("An account with this email already exists.");
      } else {
        setError(updateError.message);
      }
      return;
    }

    // Record terms acceptance in public.users
    try {
      await supabase.rpc("accept_terms", { p_version: TERMS_VERSION });
    } catch {
      // Best effort terms acceptance sync
    }

    setIsLoading(false);
    onSuccess();
  }

  async function handleGoogleSignup() {
    if (!agreedToTerms) return;
    setError(null);
    setIsCollision(false);
    setIsGoogleLoading(true);

    document.cookie = "pending_terms_accept=1; path=/; max-age=600; SameSite=Lax";

    const nextPath = window.location.pathname + window.location.search;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    const supabase = createClient();
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (linkError) {
      setIsGoogleLoading(false);
      const msg = linkError.message.toLowerCase();
      if (
        msg.includes("already linked") ||
        msg.includes("already registered") ||
        msg.includes("identity already")
      ) {
        setIsCollision(true);
        setError("A Google account with this email is already registered.");
      } else {
        // If linkIdentity fails due to project setting, fall back to OAuth sign in
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
          },
        });
        if (oauthError) {
          setError(oauthError.message);
        }
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-pop sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-pill p-1 text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close modal"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Modal Header */}
        <div className="text-center">
          <span className="inline-block rounded-full bg-accent-soft/40 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-accent border border-accent/20">
            SAVE &amp; GENERATE
          </span>
          <h2 id="signup-modal-title" className="mt-2 font-display text-h2 font-bold text-ink">
            Create your account to generate
          </h2>
          <p className="mt-1 text-xs text-ink-secondary">
            Your tailored résumé will generate immediately. Free for your first 2 résumés.
          </p>
        </div>

        {/* Google OAuth Button */}
        <div className="mt-6 flex flex-col gap-3">
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-center"
            onClick={handleGoogleSignup}
            isLoading={isGoogleLoading}
            disabled={!agreedToTerms}
          >
            {!isGoogleLoading && <GoogleIcon />}
            Continue with Google
          </Button>

          <div className="my-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">or email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmailSignup} className="flex flex-col gap-3.5">
            <Input
              id="modalFullName"
              type="text"
              label="Full name"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <Input
              id="modalEmail"
              type="email"
              label="Email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              id="modalPassword"
              type="password"
              label="Password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Checkbox
              id="modalAgreeTerms"
              className="mt-1"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              label={
                <span className="text-xs text-ink-secondary">
                  I agree to the{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-accent hover:text-accent-hover underline"
                  >
                    Terms and Conditions
                  </Link>
                  .
                </span>
              }
            />

            {error && (
              <div className="rounded border border-critical/30 bg-critical-soft/30 p-3 text-xs text-critical">
                <p>{error}</p>
                {isCollision && (
                  <div className="mt-2">
                    <button
                      type="button"
                      className="font-semibold text-accent underline hover:text-accent-hover"
                      onClick={() => {
                        router.push("/login?redirectedFrom=/resume/new");
                      }}
                    >
                      Log in to your existing account &rarr;
                    </button>
                  </div>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full mt-1"
              isLoading={isLoading}
              disabled={!agreedToTerms}
            >
              Save &amp; Build Résumé →
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-ink-muted">
          Already have an account?{" "}
          <Link
            href="/login?redirectedFrom=/resume/new"
            className="font-medium text-accent hover:text-accent-hover underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
