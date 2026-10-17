"use client";

import { usePathname } from "next/navigation";
import { GuardedLink } from "@/components/dashboard/GuardedLink";
import { MAIN_NAV_ITEMS, isNavItemActive } from "@/components/dashboard/sidebarNavItems";

// Full-screen workspaces (the resume editor, a live interview, a cover letter) need the whole
// phone screen and carry their own back/done controls, so the tab bar steps aside there. Pages
// under them (/resume/<id>/review, /duplicate) are ordinary pages and keep it.
const WORKSPACE_ROUTE = /^\/(resume\/(?!new$)|interview\/|cover-letter\/)[^/]+$/;

/** Phone-only bottom navigation: the five main pages, always one thumb away. */
export function MobileTabBar() {
  const pathname = usePathname();
  if (WORKSPACE_ROUTE.test(pathname)) return null;

  return (
    <>
      {/* Reserves the bar's height so the end of every page can scroll clear of it. */}
      <div aria-hidden="true" className="h-[calc(60px+env(safe-area-inset-bottom))] lg:hidden" />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-[10px] lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {MAIN_NAV_ITEMS.map((item) => {
            const active = isNavItemActive(item, pathname);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <GuardedLink
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="flex h-[60px] flex-col items-center justify-center gap-1 [-webkit-tap-highlight-color:transparent]"
                >
                  <span
                    className={`flex h-7 w-12 items-center justify-center rounded-pill transition-colors duration-fast ease-editorial ${
                      active ? "bg-accent-soft text-accent" : "text-ink-secondary"
                    }`}
                  >
                    <Icon className="h-[20px] w-[20px]" strokeWidth={active ? 2.25 : 1.9} />
                  </span>
                  <span
                    className={`text-[11px] leading-none ${
                      active ? "font-semibold text-accent-hover" : "font-medium text-ink-secondary"
                    }`}
                  >
                    {item.shortLabel ?? item.label}
                  </span>
                </GuardedLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
