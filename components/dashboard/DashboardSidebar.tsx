"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { GuardedLink } from "@/components/dashboard/GuardedLink";
import {
  MAIN_NAV_ITEMS,
  MORE_NAV_ITEMS,
  PROFILE_HREF,
  isNavItemActive,
  type SidebarNavItem,
} from "@/components/dashboard/sidebarNavItems";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons/LucideIcons";
import { FOCUS_SESSION_EVENT } from "@/lib/interview/focusSession";

const STORAGE_KEY = "applylab_sidebar_collapsed";
/** Interview session pages: the menu starts hidden so the question has the screen. */
const FOCUS_ROUTE = /^\/interview\/[^/]+$/;

export function DashboardSidebar({ profilePercent, isFreePlan }: { profilePercent: number; isFreePlan: boolean }) {
  const pathname = usePathname();
  const [savedCollapsed, setCollapsed] = useState(false);
  // During a live practice session the menu is hidden without touching the saved preference;
  // "Show menu" opens it for this visit only. The route is the first guess (no flash of the full
  // menu), and the workspace then says whether the session is actually live.
  const [isFocused, setIsFocused] = useState(() => FOCUS_ROUTE.test(pathname));
  const [shownInFocus, setShownInFocus] = useState(false);
  const collapsed = isFocused ? !shownInFocus : savedCollapsed;

  useEffect(() => {
    setIsFocused(FOCUS_ROUTE.test(pathname));
    setShownInFocus(false);
  }, [pathname]);

  useEffect(() => {
    const onFocus = (e: Event) => setIsFocused(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(FOCUS_SESSION_EVENT, onFocus);
    return () => window.removeEventListener(FOCUS_SESSION_EVENT, onFocus);
  }, []);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // Storage blocked (private mode): the sidebar just starts expanded.
    }
  }, []);

  function toggleCollapsed() {
    if (isFocused) {
      setShownInFocus((prev) => !prev);
      return;
    }
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Not persisted; the toggle still works for this visit.
      }
      return next;
    });
  }

  function renderItem(item: SidebarNavItem) {
    const active = isNavItemActive(item, pathname);
    const Icon = item.icon;
    const extra =
      item.href === PROFILE_HREF && profilePercent < 100 ? `${profilePercent}%` : item.proOnly && isFreePlan ? "Pro" : null;

    return (
      <GuardedLink
        key={item.href}
        href={item.href}
        data-tour={item.dataTour}
        aria-current={active ? "page" : undefined}
        // Named in both states (the collapsed menu shows icons only); the extra note is part of it.
        aria-label={extra ? `${item.label} (${extra})` : item.label}
        title={item.label}
        className={`group relative flex min-h-[44px] items-center gap-2 rounded-[10px] px-3 text-[15px] ${
          collapsed ? "justify-center" : "justify-between"
        } ${
          active
            ? "bg-accent-soft font-semibold text-accent-hover"
            : "font-medium text-neutral-700 hover:bg-paper-deep hover:text-ink"
        }`}
      >
        <span className="flex items-center gap-3">
          <Icon className={`h-[18px] w-[18px] flex-none ${active ? "text-accent" : "text-ink-muted"}`} />
          {!collapsed && item.label}
        </span>
        {!collapsed && extra && <span className="text-[13px] font-normal text-ink-muted">{extra}</span>}
        {collapsed && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[13px] font-medium text-surface opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            {item.label}
          </span>
        )}
      </GuardedLink>
    );
  }

  return (
    <aside
      className={`hidden flex-none border-r border-border px-3.5 py-5 font-dash leading-normal [&_:focus-visible]:outline-accent lg:sticky lg:top-16 lg:flex lg:h-[calc(100dvh-64px)] lg:flex-col ${
        // Collapsed: overflow visible so the hover labels can sit outside the 72px rail.
        collapsed ? "w-[72px] lg:overflow-visible" : "w-60 lg:overflow-y-auto"
      }`}
    >
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {MAIN_NAV_ITEMS.map(renderItem)}
        <div role="separator" className="m-3 h-px bg-border" />
        {MORE_NAV_ITEMS.map(renderItem)}
      </nav>

      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Show menu" : undefined}
        title={collapsed ? "Show menu" : undefined}
        className={`mt-auto flex min-h-[44px] items-center gap-2 rounded-[10px] px-3 text-[14px] font-medium text-ink-secondary ${
          collapsed ? "justify-center" : ""
        }`}
      >
        {collapsed ? (
          <ChevronRightIcon className="h-4 w-4 flex-none" strokeWidth={2} />
        ) : (
          <>
            <ChevronLeftIcon className="h-4 w-4 flex-none" strokeWidth={2} />
            Hide menu
          </>
        )}
      </button>
    </aside>
  );
}
