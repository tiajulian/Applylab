import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/marketing/Logo";

export const metadata: Metadata = {
  title: "Page Not Found | ApplyLab",
  description: "The page you are looking for does not exist or has been moved.",
};

export default function NotFound() {
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
              href="/pricing"
              className="text-ink-secondary hover:text-ink transition-colors"
            >
              Pricing
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded border border-border bg-surface p-8 shadow-sm text-center">
          <span className="inline-block px-3 py-1 text-xs font-mono font-medium tracking-wide text-accent bg-accent-soft rounded-pill mb-4">
            404 Error
          </span>

          <h1 className="font-display text-h2 text-ink">Page not found</h1>
          <p className="mt-2 text-sm text-ink-secondary leading-relaxed">
            The page you are looking for does not exist, has been moved, or the link may be out of date.
          </p>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Button variant="primary" href="/dashboard" className="w-full sm:w-auto">
              Go to Dashboard
            </Button>
            <Button variant="secondary" href="/" className="w-full sm:w-auto">
              Return Home
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
