"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { Button } from "@/components/ui/Button";
import { ChevronDownIcon, MenuIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { UserAvatarMenu } from "@/components/dashboard/UserAvatarMenu";
import { useMarketingUser } from "@/lib/marketing/useMarketingUser";

export interface MarketingNavDropdownItem {
  href: string;
  label: string;
  description?: string;
}

export interface MarketingNavLink {
  href: string;
  label: string;
  /** Always shown in the accent pill treatment, regardless of the current page. */
  highlight?: boolean;
  /** When set, the item renders as a dropdown trigger (not a direct link) listing these items. */
  dropdown?: MarketingNavDropdownItem[];
}

function NavDropdown({ label, items }: { label: string; items: MarketingNavDropdownItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1 rounded-pill px-4 py-2 transition-colors duration-fast ease-editorial hover:bg-paper-deep hover:text-ink"
      >
        {label}
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-fast ease-editorial ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-lg border border-border bg-surface p-2 shadow-pop">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="block rounded-md px-3 py-2 transition-colors hover:bg-paper-deep"
            >
              <p className="text-sm font-semibold text-ink">{item.label}</p>
              {item.description && (
                <p className="mt-0.5 text-xs text-ink-secondary">{item.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function MarketingHeader({
  navLinks,
  activeHref,
  ctaLabel = "Get Started",
  maxWidthClassName = "max-w-[1140px]",
  className = "",
}: {
  navLinks: MarketingNavLink[];
  activeHref?: string;
  ctaLabel?: string;
  maxWidthClassName?: string;
  className?: string;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Fetched client-side (not passed as a prop from a server-rendered `user`) so the marketing
  // pages that render this header don't need getCurrentUser()/headers() themselves and can be
  // served static - see lib/marketing/useMarketingUser.ts.
  const { user } = useMarketingUser();

  return (
    <header
      id="siteheader"
      className={`sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md ${className}`}
    >
      <div
        className={`mx-auto flex ${maxWidthClassName} items-center justify-between flex-nowrap gap-3 px-4 sm:px-6 lg:px-8 py-3`}
      >
        <Logo href={user ? "/dashboard" : "/"} />

        {/* Desktop Navigation (>= 980px) */}
        <nav className="hidden min-[980px]:flex items-center gap-1 text-sm font-medium text-ink-secondary">
          {navLinks.map((link) =>
            link.dropdown ? (
              <NavDropdown key={link.label} label={link.label} items={link.dropdown} />
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-pill px-4 py-2 transition-colors duration-fast ease-editorial ${
                  link.highlight || link.href === activeHref
                    ? "bg-accent-soft font-semibold text-accent"
                    : "hover:bg-paper-deep hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            )
          )}
        </nav>

        {/* Right CTA / Menu Area */}
        <div className="flex items-center gap-2.5 sm:gap-3 text-sm font-medium shrink-0">
          {user ? (
            <UserAvatarMenu user={user} showTourEntry={false} />
          ) : (
            <>
              {/* Desktop-only Login: hidden below 980px so it does not duplicate beside hamburger */}
              <Link
                href="/login"
                className="hidden min-[980px]:inline-block font-medium text-ink-secondary hover:text-ink transition-colors px-1"
              >
                Sign In
              </Link>

              {/* Primary Header CTA */}
              <a href="#score">
                <Button size="sm" className="font-semibold px-4 py-2 sm:px-5 text-sm whitespace-nowrap">
                  {ctaLabel}
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
            {navLinks.map((link) =>
              link.dropdown ? (
                <div key={link.label} className="pt-1">
                  <p className="px-3 pb-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
                    {link.label}
                  </p>
                  {link.dropdown.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block rounded-lg px-3 py-2 transition-colors hover:bg-paper-deep hover:text-ink"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : (
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
              )
            )}
          </nav>

          {user ? (
            <div className="border-t border-border pt-3">
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="w-full block">
                <Button size="lg" className="w-full font-bold text-sm">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          ) : (
            <div className="border-t border-border pt-3 flex flex-col gap-2.5">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center font-medium text-sm text-ink-secondary hover:text-ink py-2"
              >
                Sign In
              </Link>
              <a
                href="#score"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full"
              >
                <Button size="lg" className="w-full font-semibold text-sm">
                  {ctaLabel}
                </Button>
              </a>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
