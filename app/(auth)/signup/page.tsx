"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Reveal } from "@/components/ui/Reveal";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleEmailSignup(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
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
    setError(null);
    setIsGoogleLoading(true);

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

          <Button
            type="button"
            variant="secondary"
            className="mt-6 w-full"
            onClick={handleGoogleSignup}
            isLoading={isGoogleLoading}
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

            <Button type="submit" className="w-full" isLoading={isLoading}>
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
