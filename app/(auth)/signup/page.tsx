"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Reveal } from "@/components/ui/Reveal";
import { TERMS_VERSION } from "@/lib/terms";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleEmailSignup(event: React.FormEvent) {
    event.preventDefault();
    if (!agreedToTerms) return;
    setError(null);
    setIsLoading(true);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, accepted_terms_version: TERMS_VERSION },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setIsLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setConfirmationSent(true);
  }

  async function handleGoogleSignup() {
    if (!agreedToTerms) return;
    setError(null);
    setIsGoogleLoading(true);

    // Short-lived signal read by app/auth/callback/route.ts: the OAuth round trip to Google
    // and back doesn't preserve React state, so this cookie is how the callback knows consent
    // was given for this signup and should call accept_terms() once the account exists.
    document.cookie = "pending_terms_accept=1; path=/; max-age=600; SameSite=Lax";

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setIsGoogleLoading(false);
    }
  }

  if (confirmationSent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4">
        <Reveal className="w-full max-w-sm">
          <div className="rounded border border-border bg-surface p-8 text-center">
            <h1 className="font-display text-h2 text-ink">Check your inbox</h1>
            <p className="mt-2 text-sm text-ink-secondary">
              We&apos;ve sent a confirmation link to {email}. Click it to activate your account.
            </p>
          </div>
        </Reveal>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <Reveal className="w-full max-w-sm">
        <div className="rounded border border-border bg-surface p-8">
          <h1 className="font-display text-h2 text-ink">Create your account</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Build a SEEK-ready resume in minutes. Free for your first 2 resumes.
          </p>

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
                  className="font-medium text-accent hover:text-accent-hover"
                >
                  Terms and Conditions
                </Link>
                .
              </>
            }
          />

          <Button
            type="button"
            variant="secondary"
            className="mt-4 w-full"
            onClick={handleGoogleSignup}
            isLoading={isGoogleLoading}
            disabled={!agreedToTerms}
          >
            Continue with Google
          </Button>

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

            {error && <p className="text-sm text-critical">{error}</p>}

            <Button type="submit" className="w-full" isLoading={isLoading} disabled={!agreedToTerms}>
              Sign up
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-secondary">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
              Log in
            </Link>
          </p>
        </div>
      </Reveal>
    </main>
  );
}
