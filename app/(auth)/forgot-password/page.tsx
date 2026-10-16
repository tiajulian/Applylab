"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { AuthCard } from "@/components/auth/AuthCard";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!captchaToken) return;
    setError(null);
    setIsLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      captchaToken,
    });

    setIsLoading(false);

    if (resetError) {
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <AuthCard className="text-center">
        <h1 className="font-display text-h2 text-ink">Check your inbox</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          If there&apos;s an account for <strong className="font-semibold text-ink">{email}</strong>, we&apos;ve sent
          it a link to set a new password. Open it in this browser. It can take a minute, and sometimes lands in spam
          or junk.
        </p>
        <Link href="/login" className="mt-5 inline-block text-sm font-medium text-accent hover:text-accent-hover">
          Back to log in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h1 className="font-display text-h2 text-ink">Reset your password</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Enter the email you signed up with and we&apos;ll send you a link to set a new one.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <Input
          id="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

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
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-secondary">
        Signed up with Google? Just{" "}
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
          log in with Google
        </Link>
        .
      </p>
    </AuthCard>
  );
}
