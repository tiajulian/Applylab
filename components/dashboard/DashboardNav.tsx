"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { GuardedLink } from "@/components/dashboard/GuardedLink";
import { XIcon, MenuIcon, ShieldCheckIcon } from "@/components/ui/icons/LucideIcons";
import { UserAvatarMenu, type UserMenuProps } from "@/components/dashboard/UserAvatarMenu";
import { MORE_NAV_ITEMS, isNavItemActive } from "@/components/dashboard/sidebarNavItems";

/**
 * Top bar: just account things (Upgrade, avatar). Page navigation lives in one place only -
 * the sidebar on desktop, the bottom tab bar on phones - so there's never a second menu to learn.
 * On phones the menu button holds the "More tools" the tab bar has no room for.
 */
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

  useEffect(() => setIsOpen(false), [pathname]);

  const defaultUser: UserMenuProps = user ?? {
    email: "user@example.com",
    fullName: "Account",
    plan: isFreePlan ? "free" : "pro",
    isAdmin,
  };

  const upgradeLink = isFreePlan && (
    <GuardedLink
      href="/upgrade"
      className="inline-flex h-9 items-center rounded-pill border border-accent/30 bg-accent-soft px-3.5 text-[13.5px] font-semibold text-accent-hover transition-colors duration-fast ease-editorial hover:border-accent/50 hover:bg-accent/10"
    >
      Go Pro
    </GuardedLink>
  );

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {isAdmin && (
        <GuardedLink
          href="/admin"
          className={`hidden h-9 items-center gap-1.5 rounded-pill px-3 text-[13.5px] font-medium transition-colors duration-fast ease-editorial lg:inline-flex ${
            pathname.startsWith("/admin") ? "bg-paper-deep text-ink" : "text-ink-secondary hover:bg-paper-deep hover:text-ink"
          }`}
        >
          <ShieldCheckIcon className="h-4 w-4" />
          Admin
        </GuardedLink>
      )}
      <span className="hidden sm:inline-flex">{upgradeLink}</span>

      <UserAvatarMenu user={defaultUser} />

      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-secondary transition-colors duration-fast ease-editorial hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        aria-label={isOpen ? "Close more tools" : "More tools"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute inset-x-0 top-full z-40 border-b border-border bg-surface shadow-pop lg:hidden"
          >
            <nav aria-label="More tools" className="flex flex-col gap-1 px-4 py-4">
              <p className="px-3 pb-1 text-[12px] font-semibold text-ink-muted">More tools</p>
              {MORE_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(item, pathname);
                return (
                  <GuardedLink
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${active ? "bg-accent-soft" : "hover:bg-paper-deep"}`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${active ? "text-accent" : "text-ink-secondary"}`} />
                    <span className="flex flex-col">
                      <span className="text-[15px] font-medium text-ink">{item.label}</span>
                      <span className="text-[12.5px] text-ink-muted">{item.hint}</span>
                    </span>
                  </GuardedLink>
                );
              })}
              {isAdmin && (
                <GuardedLink href="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-paper-deep">
                  <ShieldCheckIcon className="h-5 w-5 shrink-0 text-ink-secondary" />
                  <span className="text-[15px] font-medium text-ink">Admin</span>
                </GuardedLink>
              )}
              {isFreePlan && <div className="mt-2 px-3 sm:hidden">{upgradeLink}</div>}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
