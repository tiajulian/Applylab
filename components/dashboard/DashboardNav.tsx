"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { PuzzleIcon } from "@/components/ui/icons/LucideIcons";
import { UserAvatarMenu, type UserMenuProps } from "@/components/dashboard/UserAvatarMenu";
import { NAV_COPY } from "@/lib/copy";

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
  const pathname = usePathname();

  const defaultUser: UserMenuProps = user ?? {
    email: "user@example.com",
    fullName: "Account",
    plan: isFreePlan ? "free" : "pro",
    isAdmin,
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  function pillClass(href: string) {
    return `inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 transition-colors duration-fast ease-editorial ${
      isActive(href)
        ? "bg-accent-soft font-semibold text-accent"
        : "font-medium text-ink-secondary hover:bg-paper-deep hover:text-ink"
    }`;
  }

  function navLinks(onNavigate: () => void) {
    return (
      <>
        <Link href="/dashboard" data-tour="nav-dashboard" className={pillClass("/dashboard")} onClick={onNavigate}>
          Dashboard
        </Link>
        <Link href="/documents" data-tour="nav-documents" className={pillClass("/documents")} onClick={onNavigate}>
          {NAV_COPY.documents}
        </Link>
        <Link href="/applications" data-tour="nav-applications" className={pillClass("/applications")} onClick={onNavigate}>
          Applications
        </Link>
        <Link href="/interview" data-tour="nav-interview" className={pillClass("/interview")} onClick={onNavigate}>
          <span>{NAV_COPY.interview}</span>
          {isFreePlan && (
            <span className="rounded-pill bg-accent px-1.5 py-0.5 text-[10px] font-semibold leading-none text-on-accent">
              Pro
            </span>
          )}
        </Link>
        <Link href="/profile" data-tour="nav-profile" className={pillClass("/profile")} onClick={onNavigate}>
          {NAV_COPY.careerProfile}
        </Link>
        <Link href="/extension" data-tour="nav-extension" className={pillClass("/extension")} onClick={onNavigate}>
          <PuzzleIcon className="h-4 w-4 shrink-0" strokeWidth={2.75} />
          <span>Extension</span>
        </Link>
        {isAdmin && (
          <Link href="/admin" className={pillClass("/admin")} onClick={onNavigate}>
            Admin
          </Link>
        )}
        {isFreePlan && (
          <Link
            href="/upgrade"
            className="inline-flex items-center rounded-pill bg-accent px-3 py-1.5 font-semibold text-on-accent shadow-sm transition-colors duration-fast ease-editorial hover:bg-accent-hover"
            onClick={onNavigate}
          >
            Upgrade
          </Link>
        )}
      </>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <nav className="hidden items-center gap-1 text-sm sm:flex">{navLinks(() => {})}</nav>

      <div className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />

      <UserAvatarMenu user={defaultUser} />

      <button
        type="button"
        className="inline-flex items-center justify-center rounded-md p-2 text-ink-secondary transition-colors duration-fast ease-editorial hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
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

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute inset-x-0 top-full z-10 overflow-hidden border-b border-border bg-surface shadow-pop sm:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-4 text-sm">{navLinks(() => setIsOpen(false))}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
