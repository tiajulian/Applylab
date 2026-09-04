"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { Button } from "@/components/ui/Button";
import { MenuIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { UserAvatarMenu, type UserMenuProps } from "@/components/dashboard/UserAvatarMenu";

export interface MarketingNavLink {
  href: string;
  label: string;
  /** Always shown in the accent pill treatment, regardless of the current page. */
  highlight?: boolean;
}

export function MarketingHeader({
  navLinks,
  activeHref,
  user,
  ctaLabel = "Score your resume free",
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header
      id="siteheader"
      className={`sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md ${className}`}
    >
      <div
        className={`mx-auto flex ${maxWidthClassName} items-center justify-between flex-nowrap gap-3 px-4 sm:px-6 lg:px-8 py-3`}
      >
        <Logo />

        {/* Desktop Navigation (>= 980px) */}
        <nav className="hidden min-[980px]:flex items-center gap-1 text-xs font-semibold text-ink-secondary">
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

        {/* Right CTA / Menu Area */}
        <div className="flex items-center gap-2.5 sm:gap-3 text-xs font-semibold shrink-0">
          {user ? (
            <UserAvatarMenu user={user} showTourEntry={false} />
          ) : (
            <>
              {/* Desktop-only Login: hidden below 980px so it does not duplicate beside hamburger */}
              <Link
                href="/login"
                className="hidden min-[980px]:inline-block font-medium text-ink-secondary hover:text-ink transition-colors px-1"
              >
                Log in
              </Link>

              {/* Primary Header CTA: shortens below 620px so it cannot wrap */}
              <a href="#score">
                <Button size="sm" className="font-bold px-3 py-1.5 sm:px-4 text-xs whitespace-nowrap">
                  <span className="hidden min-[620px]:inline">{ctaLabel}</span>
                  <span className="min-[620px]:hidden">Score free</span>
                </Button>
              </a>
            </>
          )}

          {/* Mobile Hamburger Button (< 980px): gives logged-in and logged-out visitors alike
              a way to reach the marketing nav links, since the desktop nav is hidden here. */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            className="min-[980px]:hidden inline-flex items-center justify-center p-1.5 rounded-lg text-ink-secondary hover:text-ink hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {mobileMenuOpen ? (
              <XIcon className="w-5 h-5" />
            ) : (
              <MenuIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav"
          className="min-[980px]:hidden border-t border-border bg-surface px-4 py-4 shadow-lg space-y-3"
        >
          <nav className="flex flex-col gap-1 text-sm font-semibold text-ink-secondary">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`rounded-lg px-3 py-2 transition-colors ${
                  link.highlight
                    ? "bg-accent-soft text-accent font-bold"
                    : "hover:bg-paper-deep hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {!user && (
            <div className="border-t border-border pt-3 flex flex-col gap-2.5">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center font-medium text-sm text-ink-secondary hover:text-ink py-2"
              >
                Log in
              </Link>
              <a
                href="#score"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full"
              >
                <Button size="lg" className="w-full font-bold text-sm">
                  Score your resume free
                </Button>
              </a>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
