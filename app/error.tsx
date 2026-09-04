"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/marketing/Logo";
import { RotateCwIcon } from "@/components/ui/icons/LucideIcons";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to browser console and telemetry
    console.error("Unhandled client error in app route:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="border-b border-border bg-paper/90 px-5 sm:px-8 py-3.5">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link
              href="/dashboard"
              className="text-ink-secondary hover:text-ink transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/"
              className="text-ink-secondary hover:text-ink transition-colors"
            >
              Home
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-16" role="alert">
        <div className="w-full max-w-md rounded border border-border bg-surface p-8 shadow-sm text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-critical-soft text-critical">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          <h1 className="font-display text-h2 text-ink">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-secondary leading-relaxed">
            An unexpected error occurred while loading this page. You can try refreshing or returning to your dashboard.
          </p>

          {error?.digest && (
            <div className="mt-4 inline-block rounded bg-paper-deep px-3 py-1.5">
              <span className="font-mono text-xs text-ink-muted">Error reference: {error.digest}</span>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Button
              variant="primary"
              onClick={() => reset()}
              className="w-full sm:w-auto"
            >
              <RotateCwIcon className="h-4 w-4" />
              Try again
            </Button>
            <Button
              variant="secondary"
              href="/dashboard"
              className="w-full sm:w-auto"
            >
              Go to Dashboard
            </Button>
            <Button
              variant="outline"
              href="/"
              className="w-full sm:w-auto"
            >
              Return Home
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
