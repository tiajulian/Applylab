"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { GoogleIcon } from "@/components/ui/icons/GoogleIcon";
import { Input } from "@/components/ui/Input";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { AuthCard } from "@/components/auth/AuthCard";
import { safeNextPath } from "@/lib/url/safeNextPath";
import { SCORE_CLAIM_PATH, SCORE_CLAIM_SIGNUP_URL } from "@/lib/resume/scoreClaimCookie";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = safeNextPath(searchParams.get("redirectedFrom"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Remounts the captcha after a failed attempt: its token is single-use, so without a fresh one
  // "Log in" stayed greyed out after a mistyped password until the page was reloaded.
  const [captchaKey, setCaptchaKey] = useState(0);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "identity_exists"
      ? "That Google account is already registered with ApplyLab. Log in with it below."
      : searchParams.get("error") === "auth_callback_error"
        ? "That sign-in link didn't work. It may have expired or been used already. Please try again."
        : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  // Onboarding saves progress under a guest (anonymous) session before signup. Said out loud here
  // so a visitor bounced from the app back to onboarding knows why, and how to get back to it.
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    void createClient()
      .auth.getUser()
      .then(({ data }) => setIsGuest(Boolean(data.user?.is_anonymous)));
  }, []);

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

    // The resume-score claim is a route handler that adds a resume, so it gets one full page load
    // (a client navigation plus refresh could run it twice).
    if (redirectedFrom === SCORE_CLAIM_PATH) {
      window.location.assign(SCORE_CLAIM_PATH);
      return;
    }
    router.push(redirectedFrom);
    router.refresh();
  }

  async function handleGoogleLogin() {
    setError(null);
    setIsGoogleLoading(true);

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          redirectedFrom
        )}`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setIsGoogleLoading(false);
    }
  }

  return (
    <AuthCard>
      <h1 className="font-display text-h2 text-ink">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Log in to keep building your Australian resume.
      </p>

      {isGuest && (
        <p className="mt-4 rounded-lg bg-paper-deep px-3 py-2.5 text-sm text-ink-secondary">
          You&apos;re part-way through setting up as a guest, without an account yet.{" "}
          <Link href="/onboarding" className="font-medium text-accent hover:text-accent-hover">
            Continue setting up
          </Link>{" "}
          or log in to an account you already have.
        </p>
      )}

      <Button
        type="button"
        variant="secondary"
        className="mt-6 w-full"
        onClick={handleGoogleLogin}
        isLoading={isGoogleLoading}
      >
        {!isGoogleLoading && <GoogleIcon />}
        Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-ink-muted">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
        <Input
          id="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <Input
            id="password"
            type="password"
            label="Password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Link
            href="/forgot-password"
            className="self-end text-[13px] font-medium text-accent hover:text-accent-hover"
          >
            Forgot password?
          </Link>
        </div>

        <div className="flex justify-center">
          <TurnstileWidget
            key={captchaKey}
            onVerify={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
            onError={() => setCaptchaToken(null)}
          />
        </div>

        {error && <p className="text-sm text-critical">{error}</p>}

        <Button type="submit" className="w-full" isLoading={isLoading} disabled={!captchaToken}>
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-secondary">
        Don&apos;t have an account?{" "}
        {/* Keeps a resume-score claim through to signup, so the held score isn't lost on the way. */}
        <Link
          href={redirectedFrom === SCORE_CLAIM_PATH ? SCORE_CLAIM_SIGNUP_URL : "/signup"}
          className="font-medium text-accent hover:text-accent-hover"
        >
          Sign up
        </Link>
      </p>
    </AuthCard>
  );
}
