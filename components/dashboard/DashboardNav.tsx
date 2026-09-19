"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { GuardedLink } from "@/components/dashboard/GuardedLink";
import { PuzzleIcon, XIcon, MenuIcon } from "@/components/ui/icons/LucideIcons";
import { UserAvatarMenu, type UserMenuProps } from "@/components/dashboard/UserAvatarMenu";
import { SIDEBAR_NAV_ITEMS } from "@/components/dashboard/sidebarNavItems";
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
        <GuardedLink href="/documents" data-tour="nav-documents" className={pillClass("/documents")} onClick={onNavigate}>
          {NAV_COPY.documents}
        </GuardedLink>
        <GuardedLink href="/profile" data-tour="nav-profile" className={pillClass("/profile")} onClick={onNavigate}>
          {NAV_COPY.careerProfile}
        </GuardedLink>
        <GuardedLink href="/extension" data-tour="nav-extension" className={pillClass("/extension")} onClick={onNavigate}>
          <PuzzleIcon className="h-4 w-4 shrink-0" strokeWidth={2} />
          <span>Extension</span>
        </GuardedLink>
        {isAdmin && (
          <GuardedLink href="/admin" className={pillClass("/admin")} onClick={onNavigate}>
            Admin
          </GuardedLink>
        )}
        {isFreePlan && (
          <GuardedLink
            href="/upgrade"
            className="inline-flex items-center rounded-pill bg-accent px-3 py-1.5 font-semibold text-on-accent shadow-sm transition-colors duration-fast ease-editorial hover:bg-accent-hover"
            onClick={onNavigate}
          >
            Upgrade
          </GuardedLink>
        )}
      </>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <nav className="hidden items-center gap-1 text-sm lg:flex">{navLinks(() => {})}</nav>

      <div className="hidden h-6 w-px bg-border lg:block" aria-hidden="true" />

      <UserAvatarMenu user={defaultUser} />

      <button
        type="button"
        className="inline-flex items-center justify-center rounded-md p-2 text-ink-secondary transition-colors duration-fast ease-editorial hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute inset-x-0 top-full z-10 overflow-hidden border-b border-border bg-surface shadow-pop lg:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-4 text-sm">
              {SIDEBAR_NAV_ITEMS.filter((item) => item.href !== "/extension").map(({ label, href, icon: Icon, dataTour, disabled }) =>
                disabled ? (
                  <span key={label} className="flex items-center gap-2 rounded-pill px-3 py-1.5 text-ink-muted/60">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{label}</span>
                    <span className="rounded-pill bg-paper-deep px-1.5 py-0.5 text-[10px] font-semibold">Soon</span>
                  </span>
                ) : (
                  <GuardedLink
                    key={label}
                    href={href}
                    data-tour={dataTour}
                    className={pillClass(href)}
                    onClick={() => setIsOpen(false)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{label}</span>
                    {href === "/interview" && isFreePlan && (
                      <span className="rounded-pill bg-accent px-1.5 py-0.5 text-[10px] font-semibold leading-none text-on-accent">
                        Pro
                      </span>
                    )}
                  </GuardedLink>
                )
              )}
              <div className="my-1 h-px bg-border" aria-hidden="true" />
              {navLinks(() => setIsOpen(false))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

