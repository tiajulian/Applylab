"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthCard } from "@/components/auth/AuthCard";

const MIN_PASSWORD_LENGTH = 8;

/** The form half of /reset-password; page.tsx decides whether the reset link was valid. */
export function ResetPasswordForm({ canReset }: { canReset: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error: updateError } = await createClient().auth.updateUser({ password });

    if (updateError) {
      setIsLoading(false);
      setError(updateError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (!canReset) {
    return (
      <AuthCard className="text-center">
        <h1 className="font-display text-h2 text-ink">This link has expired</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Reset links work once, for a limited time, in the browser you requested them from. Ask for a new one.
        </p>
        <Button href="/forgot-password" className="mt-5 w-full">
          Send a new link
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h1 className="font-display text-h2 text-ink">Set a new password</h1>
      <p className="mt-1 text-sm text-ink-secondary">At least {MIN_PASSWORD_LENGTH} characters.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <Input
          id="password"
          type="password"
          label="New password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="text-sm text-critical">{error}</p>}

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Save and continue
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-secondary">
        <Link href="/dashboard" className="font-medium text-accent hover:text-accent-hover">
          Skip for now
        </Link>
      </p>
    </AuthCard>
  );
}
