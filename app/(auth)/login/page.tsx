"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { GoogleIcon } from "@/components/ui/icons/GoogleIcon";
import { Input } from "@/components/ui/Input";
import { Reveal } from "@/components/ui/Reveal";

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
  const redirectedFrom = searchParams.get("redirectedFrom") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  async function handleEmailLogin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (signInError) {
      setError(signInError.message);
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
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <Reveal className="w-full max-w-sm">
        <div className="rounded border border-border bg-surface p-8">
          <h1 className="font-display text-h2 text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Log in to keep building your Australian resume.
          </p>

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
            <Input
              id="password"
              type="password"
              label="Password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error && <p className="text-sm text-critical">{error}</p>}

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Log in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-secondary">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-accent hover:text-accent-hover">
              Sign up
            </Link>
          </p>
        </div>
      </Reveal>
    </main>
  );
}
