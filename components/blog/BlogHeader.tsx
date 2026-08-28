import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { Button } from "@/components/ui/Button";

interface BlogHeaderProps {
  userSession?: {
    isLoggedIn: boolean;
    initials?: string;
  };
}

export function BlogHeader({ userSession }: BlogHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:py-3.5">
        <Logo />

        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-ink-secondary">
          <Link href="/#how-it-works" className="hover:text-ink transition-colors">
            How it works
          </Link>
          <Link href="/#why-applylab" className="hover:text-ink transition-colors">
            Why ApplyLab
          </Link>
          <Link href="/pricing" className="hover:text-ink transition-colors">
            Pricing
          </Link>
          <Link href="/blog" className="text-accent font-bold transition-colors">
            Blog &amp; Guides
          </Link>
        </nav>

        <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold">
          {userSession?.isLoggedIn ? (
            <Link
              href="/dashboard"
              aria-label="Go to your dashboard"
              title="You're logged in"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent transition-opacity duration-fast ease-editorial hover:opacity-90 shadow-sm"
            >
              {userSession.initials || "ME"}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="font-medium text-ink-secondary hover:text-ink transition-colors"
              >
                Log in
              </Link>
              <Link href="/onboarding">
                <Button size="sm" className="font-bold px-3 py-1.5 sm:px-4 text-xs">
                  Start for free &rarr;
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
