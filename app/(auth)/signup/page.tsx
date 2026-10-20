"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { GoogleIcon } from "@/components/ui/icons/GoogleIcon";
import { Input } from "@/components/ui/Input";
import { AuthCard } from "@/components/auth/AuthCard";
import { TermsNotice } from "@/components/auth/TermsNotice";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { TERMS_VERSION } from "@/lib/terms";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Remounts the captcha after a failed attempt: its token is single-use.
  const [captchaKey, setCaptchaKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleEmailSignup(event: React.FormEvent) {
    event.preventDefault();
    if (!captchaToken) return;
    setError(null);
    setGoogleError(null);
    setIsLoading(true);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, accepted_terms_version: TERMS_VERSION },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        captchaToken,
      },
    });

    setIsLoading(false);

    if (signUpError) {
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
      setError(signUpError.message);
      return;
    }

    setConfirmationSent(true);
  }

  async function handleGoogleSignup() {
    setError(null);
    setGoogleError(null);
    setIsGoogleLoading(true);

    // Short-lived signal read by app/auth/callback/route.ts: the OAuth round trip to Google
    // and back doesn't preserve React state, so this cookie is how the callback knows consent
    // was given (by clicking past the terms notice) and should call accept_terms() once the
    // account exists.
    document.cookie = "pending_terms_accept=1; path=/; max-age=600; SameSite=Lax";

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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
          We&apos;ve sent a confirmation link to <strong className="font-semibold text-ink">{email}</strong>. Click it
          to activate your account. It can take a minute, and sometimes lands in spam or junk.
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

      <TermsNotice className="mt-6" />

      <Button
        type="button"
        variant="secondary"
        className="mt-3 w-full"
        onClick={handleGoogleSignup}
        isLoading={isGoogleLoading}
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
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

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
          disabled={!captchaToken}
        >
          Sign up
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-secondary">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
