import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { Button } from "@/components/ui/Button";
import { UserAvatarMenu, type UserMenuProps } from "@/components/dashboard/UserAvatarMenu";
import type { CurrentUser } from "@/lib/getCurrentUser";

export interface MarketingNavLink {
  href: string;
  label: string;
  /** Always shown in the accent pill treatment, regardless of the current page (e.g. a promoted tool). */
  highlight?: boolean;
}

/** Builds the UserAvatarMenu prop shape from getCurrentUser()'s result, or null for a logged-out
 * (or anonymous mid-onboarding) visitor, who sees the Log in / Sign up CTAs instead. */
export function toMarketingUser(currentUser: CurrentUser | null): UserMenuProps | null {
  if (!currentUser || currentUser.isAnonymous) return null;
  return {
    email: currentUser.authEmail,
    fullName: currentUser.appUser?.full_name ?? undefined,
    avatarUrl: currentUser.avatarUrl,
    plan: currentUser.appUser?.plan ?? "free",
    isAdmin: currentUser.appUser?.is_admin ?? false,
  };
}

export function MarketingHeader({
  navLinks,
  activeHref,
  user,
  ctaLabel = "Start for free",
  maxWidthClassName = "max-w-[1140px]",
  className = "",
}: {
  navLinks: MarketingNavLink[];
  activeHref?: string;
  user: UserMenuProps | null;
  ctaLabel?: string;
  maxWidthClassName?: string;
  className?: string;
}) {
  return (
    <header className={`sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md ${className}`}>
      <div className={`mx-auto flex ${maxWidthClassName} items-center justify-between px-5 sm:px-8 py-3.5`}>
        <Logo />

        <nav className="hidden md:flex items-center gap-1 text-xs font-semibold text-ink-secondary">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-pill px-3 py-1.5 transition-colors duration-fast ease-editorial ${
                link.highlight || link.href === activeHref
                  ? "bg-accent-soft font-bold text-accent"
                  : "hover:bg-paper-deep hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold">
          {user ? (
            <UserAvatarMenu user={user} showTourEntry={false} />
          ) : (
            <>
              <Link href="/login" className="font-medium text-ink-secondary hover:text-ink transition-colors">
                Log in
              </Link>
              <Link href="/onboarding">
                <Button size="sm" className="font-bold px-3 py-1.5 sm:px-4 text-xs">
                  {ctaLabel}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
