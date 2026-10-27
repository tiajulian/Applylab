"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { GoogleIcon } from "@/components/ui/icons/GoogleIcon";
import { EyeIcon, EyeOffIcon, XIcon, ArrowRightIcon, MailIcon } from "@/components/ui/icons/LucideIcons";
import { Input } from "@/components/ui/Input";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { TermsNotice } from "./TermsNotice";
import { TERMS_VERSION } from "@/lib/terms";
import { ACCOUNT_EXISTS_MESSAGE, friendlyAuthError, PASSWORD_RULES_HINT, passwordProblem } from "@/lib/auth/passwordRules";

interface SignupAtGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** "signup" upgraded the guest session; "login" signed into a different, existing account. */
  onSuccess: (via: "signup" | "login") => void | Promise<void>;
  defaultFullName?: string;
  badgeText?: string;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
}

type Mode = "signup" | "login";

export function SignupAtGenerateModal({
  isOpen,
  onClose,
  onSuccess,
  defaultFullName = "",
  badgeText = "FREE ACCOUNT",
  title = "Create your free account",
  subtitle = "It's free and takes 20 seconds. Everything you've entered so far is kept.",
  submitLabel = "Create account & continue",
}: SignupAtGenerateModalProps) {
  const [mode, setMode] = useState<Mode>("signup");
  const [fullName, setFullName] = useState(defaultFullName);
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Remounts the captcha after a failed log in: its token is single-use.
  const [captchaKey, setCaptchaKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isCollision, setIsCollision] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  // Set when "Confirm email" is on: the account only becomes real once they click the link.
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (defaultFullName && !fullName) {
      setFullName(defaultFullName);
    }
  }, [defaultFullName, fullName]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    // Capture phase on window runs before any other dialog's listener, and stopping it there means
    // Escape closes only this (topmost) dialog, not also the one it opened over.
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setIsCollision(false);
    setCaptchaToken(null);
  }

  async function handleEmailSignup(event: React.FormEvent) {
    event.preventDefault();
    setIsCollision(false);
    const weak = passwordProblem(password);
    setError(weak);
    if (weak) return;
    setIsLoading(true);

    const supabase = createClient();

    // Convert the anonymous user to a permanent email/password user. If the project confirms
    // emails, the link in that email brings them back to this same page, signed in.
    const nextPath = window.location.pathname + window.location.search;
    const { data: updated, error: updateError } = await supabase.auth.updateUser(
      {
        email,
        password,
        data: { full_name: fullName, accepted_terms_version: TERMS_VERSION },
      },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` }
    );

    if (updateError) {
      setIsLoading(false);
      // One definition of "already registered" (friendlyAuthError), shared with every signup form.
      // The wording here differs because this modal shows its own "Log in" button underneath.
      if (friendlyAuthError(updateError) === ACCOUNT_EXISTS_MESSAGE) {
        setIsCollision(true);
        setError("An account with this email already exists.");
      } else {
        setError(friendlyAuthError(updateError));
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
    // Still a guest means the email is waiting to be confirmed: say so here, clearly, rather than
    // closing and carrying on with an action the server would still refuse.
    if (updated.user?.is_anonymous) {
      setConfirmationSentTo(email);
      return;
    }
    onSuccess("signup");
  }

  async function handleGoogleSignup() {
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

  // Plain sign-in (as opposed to handleEmailSignup's account upgrade) - used when the person
  // already has a real account, so we authenticate as *them* rather than converting the current
  // anonymous session. Runs entirely in place (no navigation) so whatever they've typed on the
  // page behind this modal survives, then onSuccess() resumes the AI action that opened it.
  async function handleEmailLogin(event: React.FormEvent) {
    event.preventDefault();
    if (!captchaToken) return;
    setError(null);
    setIsLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    });

    setIsLoading(false);

    if (signInError) {
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
      setError(signInError.message);
      return;
    }

    onSuccess("login");
  }

  async function handleGoogleLogin() {
    setError(null);
    setIsGoogleLoading(true);

    const nextPath = window.location.pathname + window.location.search;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (oauthError) {
      setIsGoogleLoading(false);
      setError(oauthError.message);
    }
  }

  const isLogin = mode === "login";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-modal-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button - a sibling of the scrollable content below, not a child of it, so it
            can't scroll out of reach on a short mobile screen once the form overflows 90vh. */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-pill text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-auto sm:w-auto sm:p-1"
          aria-label="Close modal"
        >
          <XIcon className="h-5 w-5" />
        </button>

        {confirmationSentTo ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center sm:p-10">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-hover"
            >
              <MailIcon className="h-6 w-6" />
            </span>
            <h2 id="signup-modal-title" className="font-display text-[24px] font-bold leading-tight text-ink">
              Check your email
            </h2>
            <p className="text-[15px] leading-relaxed text-ink-secondary">
              We sent a link to <strong className="font-semibold text-ink">{confirmationSentTo}</strong>. Click it
              to finish creating your account. It brings you straight back here, and everything you&apos;ve
              entered is kept.
            </p>
            <p className="text-[13px] text-ink-muted">Can&apos;t see it? Check your spam or junk folder.</p>
            <Button type="button" className="mt-2 w-full justify-center" onClick={onClose}>
              OK
            </Button>
          </div>
        ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
          {/* Modal Header */}
          <div className="text-center">
            <span className="inline-block rounded-full bg-accent-soft/40 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-accent border border-accent/20">
              {isLogin ? "WELCOME BACK" : badgeText}
            </span>
            <h2 id="signup-modal-title" className="mt-2 font-display text-[24px] font-bold leading-tight text-ink sm:text-[27px]">
              {isLogin ? "Log in to continue" : title}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-secondary">
              {isLogin ? "Log in and we'll pick up right where you left off." : subtitle}
            </p>
          </div>

          {/* Google OAuth Button */}
          <div className="mt-6 flex flex-col gap-3">
            {!isLogin && <TermsNotice />}

            <Button
              type="button"
              variant="secondary"
              className="w-full justify-center"
              onClick={isLogin ? handleGoogleLogin : handleGoogleSignup}
              isLoading={isGoogleLoading}
            >
              {!isGoogleLoading && <GoogleIcon />}
              Continue with Google
            </Button>

            <div className="my-2 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-wide text-ink-muted">or email</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={isLogin ? handleEmailLogin : handleEmailSignup} className="flex flex-col gap-3.5">
              {!isLogin && (
                <Input
                  id="modalFullName"
                  type="text"
                  label="Full name"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              )}
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
                type={showPassword ? "text" : "password"}
                label="Password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                aria-describedby={isLogin ? undefined : "modalPasswordRules"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-ink-muted hover:text-ink"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                }
              />
              {!isLogin && (
                <p id="modalPasswordRules" className="-mt-2 text-xs text-ink-muted">
                  {PASSWORD_RULES_HINT}
                </p>
              )}

              {isLogin && (
                <div className="flex justify-center">
                  <TurnstileWidget
                    key={captchaKey}
                    onVerify={setCaptchaToken}
                    onExpire={() => setCaptchaToken(null)}
                    onError={() => setCaptchaToken(null)}
                  />
                </div>
              )}

              {error && (
                <div role="alert" className="rounded border border-critical/30 bg-critical-soft/30 p-3 text-xs text-critical">
                  <p>{error}</p>
                  {isCollision && (
                    <div className="mt-2">
                      <button
                        type="button"
                        className="font-semibold text-accent underline hover:text-accent-hover"
                        onClick={() => switchMode("login")}
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
                disabled={isLogin && !captchaToken}
              >
                {isLogin ? "Log in" : <>{submitLabel} <ArrowRightIcon className="h-4 w-4" /></>}
              </Button>
            </form>
          </div>

          <p className="mt-4 text-center text-xs text-ink-muted">
            {isLogin ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className="font-medium text-accent hover:text-accent-hover underline"
                  onClick={() => switchMode("signup")}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="font-medium text-accent hover:text-accent-hover underline"
                  onClick={() => switchMode("login")}
                >
                  Log in
                </button>
              </>
            )}
          </p>
        </div>
        )}
      </div>
    </div>
  );
}
