"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/ui/LogoutButton";

import { UserAvatarMenu, type UserMenuProps } from "@/components/dashboard/UserAvatarMenu";

export function DashboardNav({
  isFreePlan,
  isAdmin = false,
  user,
}: {
  isFreePlan: boolean;
  isAdmin?: boolean;
  user?: UserMenuProps;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const defaultUser: UserMenuProps = user ?? {
    email: "user@example.com",
    fullName: "Account",
    plan: isFreePlan ? "free" : "pro",
    isAdmin,
  };

  function navLinks(onNavigate: () => void) {
    return (
      <>
        <Link
          href="/dashboard"
          className="text-ink-secondary transition-colors duration-fast ease-editorial hover:text-ink font-medium"
          onClick={onNavigate}
        >
          Resumes
        </Link>
        <Link
          href="/applications"
          className="text-ink-secondary transition-colors duration-fast ease-editorial hover:text-ink font-medium"
          onClick={onNavigate}
        >
          Applications
        </Link>
        <Link
          href="/profile"
          className="text-ink-secondary transition-colors duration-fast ease-editorial hover:text-ink font-medium"
          onClick={onNavigate}
        >
          Profile
        </Link>
        {isAdmin && (
          <Link
            href="/admin"
            className="text-ink-secondary transition-colors duration-fast ease-editorial hover:text-ink font-medium"
            onClick={onNavigate}
          >
            Admin
          </Link>
        )}
        {isFreePlan && (
          <Link
            href="/upgrade"
            className="rounded-pill bg-accent-soft px-3 py-1 font-medium text-accent transition-colors duration-fast ease-editorial hover:bg-accent hover:text-on-accent"
            onClick={onNavigate}
          >
            Upgrade
          </Link>
        )}
      </>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <nav className="hidden items-center gap-6 text-sm sm:flex">
        {navLinks(() => {})}
      </nav>

      <UserAvatarMenu user={defaultUser} />

      <button
        type="button"
        className="inline-flex items-center justify-center rounded p-2 text-ink-secondary transition-colors duration-fast ease-editorial hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {isOpen && (
        <div className="absolute inset-x-0 top-full z-10 flex flex-col gap-3 border-b border-border bg-surface px-4 py-4 text-sm shadow-pop sm:hidden">
          {navLinks(() => setIsOpen(false))}
        </div>
      )}
    </div>
  );
}
