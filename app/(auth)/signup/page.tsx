"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { GoogleIcon } from "@/components/ui/icons/GoogleIcon";
import { Input } from "@/components/ui/Input";
import { AuthCard } from "@/components/auth/AuthCard";
import { Checkbox } from "@/components/ui/Checkbox";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { TERMS_VERSION } from "@/lib/terms";
import { ACCOUNT_EXISTS_MESSAGE, friendlyAuthError, PASSWORD_RULES_HINT, passwordProblem } from "@/lib/auth/passwordRules";
import { SCORE_CLAIM_CALLBACK_PATH, SCORE_CLAIM_LOGIN_URL, SCORE_CLAIM_PATH } from "@/lib/resume/scoreClaimCookie";

// Sent here from the resume-score log-in (?redirectedFrom=/resume-score/claim): come back through
// the claim so the held score is added to the new account, and keep it if they switch to log in.
// Read from the URL directly rather than with useSearchParams, which would need a Suspense
// boundary around this page.
function wantsScoreClaim(): boolean {
  return new URLSearchParams(window.location.search).get("redirectedFrom") === SCORE_CLAIM_PATH;
}

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Remounts the captcha after a failed attempt: its token is single-use.
  const [captchaKey, setCaptchaKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const [loginHref, setLoginHref] = useState("/login");
  useEffect(() => {
    if (wantsScoreClaim()) setLoginHref(SCORE_CLAIM_LOGIN_URL);
  }, []);

  function authCallbackUrl(): string {
    return `${window.location.origin}${wantsScoreClaim() ? SCORE_CLAIM_CALLBACK_PATH : "/auth/callback"}`;
  }

  async function handleEmailSignup(event: React.FormEvent) {
    event.preventDefault();
    if (!captchaToken || !agreedToTerms) return;
    setGoogleError(null);
    // Checked before submitting, so a weak password doesn't use up the captcha.
    const weak = passwordProblem(password);
    setError(weak);
    if (weak) return;
    setIsLoading(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, accepted_terms_version: TERMS_VERSION },
        emailRedirectTo: authCallbackUrl(),
        captchaToken,
      },
    });

    setIsLoading(false);

    // With email confirmation on, Supabase answers an already-registered email with a stand-in user
    // that has no identities and sends no email, so "check your inbox" would be a dead end.
    const alreadyRegistered = !signUpError && data.user?.identities?.length === 0;
    if (signUpError || alreadyRegistered) {
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
      setError(signUpError ? friendlyAuthError(signUpError) : ACCOUNT_EXISTS_MESSAGE);
      return;
    }

    // Signed in straight away (no email confirmation needed): add the held score now.
    if (data.session && wantsScoreClaim()) {
      window.location.assign(SCORE_CLAIM_PATH);
      return;
    }

    setConfirmationSent(true);
  }

  async function handleGoogleSignup() {
    if (!agreedToTerms) return;
    setError(null);
    setGoogleError(null);
    setIsGoogleLoading(true);

    // Short-lived signal read by app/auth/callback/route.ts: the OAuth round trip to Google
    // and back doesn't preserve React state, so this cookie is how the callback knows consent
    // was given (by ticking the terms checkbox) and should call accept_terms() once the
    // account exists.
    document.cookie = "pending_terms_accept=1; path=/; max-age=600; SameSite=Lax";

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: authCallbackUrl(),
      },
    });

    if (oauthError) {
      setGoogleError(oauthError.message);
      setIsGoogleLoading(false);
    }
  }

  if (confirmationSent) {
    return (
      <AuthCard className="text-center">
        <h1 className="font-display text-h2 text-ink">Check your inbox</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          We&apos;ve sent a confirmation link to <strong className="font-semibold text-ink">{email}</strong>.{" "}
          {wantsScoreClaim()
            ? "Open it in this browser to activate your account, and your score report will be waiting."
            : "Click it to activate your account."}{" "}
          It can take a minute, and sometimes lands in spam or junk.
        </p>
        <button
          type="button"
          onClick={() => {
            setConfirmationSent(false);
            setCaptchaToken(null);
          }}
          className="mt-5 text-sm font-medium text-accent hover:text-accent-hover"
        >
          Wrong email? Go back
        </button>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h1 className="font-display text-h2 text-ink">Create your account</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Build a SEEK-ready resume in minutes. Free for your first resume.
      </p>

      {/* One required checkbox gates both sign-up paths (Google and email), so it sits above
          the first of them. */}
      <Checkbox
        id="agreeTerms"
        className="mt-6"
        checked={agreedToTerms}
        onChange={(e) => setAgreedToTerms(e.target.checked)}
        label={
          <>
            I agree to the{" "}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent underline hover:text-accent-hover"
            >
              Terms and Conditions
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent underline hover:text-accent-hover"
            >
              Privacy Policy
            </Link>
            .
          </>
        }
      />

      <Button
        type="button"
        variant="secondary"
        className="mt-3 w-full"
        onClick={handleGoogleSignup}
        isLoading={isGoogleLoading}
        disabled={!agreedToTerms}
      >
        {!isGoogleLoading && <GoogleIcon />}
        Continue with Google
      </Button>

      {googleError && (
        <p role="alert" className="mt-2 text-sm text-critical">
          {googleError}
        </p>
      )}

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-ink-muted">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmailSignup} className="flex flex-col gap-4">
        <Input
          id="fullName"
          type="text"
          label="Full name"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Input
          id="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          id="password"
          type="password"
          label="Password"
          autoComplete="new-password"
          required
          aria-describedby="passwordRules"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p id="passwordRules" className="-mt-2 text-xs text-ink-muted">{PASSWORD_RULES_HINT}</p>

        <div className="flex justify-center">
          <TurnstileWidget
            key={captchaKey}
            onVerify={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
            onError={() => setCaptchaToken(null)}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-critical">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          isLoading={isLoading}
          disabled={!captchaToken || !agreedToTerms}
        >
          Sign up
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-secondary">
        Already have an account?{" "}
        <Link href={loginHref} className="font-medium text-accent hover:text-accent-hover">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
