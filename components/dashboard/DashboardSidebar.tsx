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

const STORAGE_KEY = "applylab_sidebar_collapsed";

export function DashboardSidebar({ profilePercent, isFreePlan }: { profilePercent: number; isFreePlan: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // Storage blocked (private mode): the sidebar just starts expanded.
    }
  }, []);

  function toggleCollapsed() {
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
        aria-label={collapsed ? item.label : undefined}
        title={collapsed ? item.label : undefined}
        className={`flex min-h-[44px] items-center gap-2 rounded-[10px] px-3 text-[15px] ${
          collapsed ? "justify-center" : "justify-between"
        } ${
          active
            ? "bg-dash-orange-tint font-semibold text-dash-orange-deep"
            : "font-medium text-dash-nav hover:bg-dash-divider hover:text-dash-text"
        }`}
      >
        <span className="flex items-center gap-3">
          <Icon className={`h-[18px] w-[18px] flex-none ${active ? "text-dash-orange-ink" : "text-dash-muted"}`} />
          {!collapsed && item.label}
        </span>
        {!collapsed && extra && <span className="text-[13px] font-normal text-dash-muted">{extra}</span>}
      </GuardedLink>
    );
  }

  return (
    <aside
      className={`hidden flex-none border-r border-dash-border px-3.5 py-5 font-dash leading-normal [&_:focus-visible]:outline-dash-orange-ink lg:sticky lg:top-16 lg:flex lg:h-[calc(100dvh-64px)] lg:flex-col lg:overflow-y-auto ${
        collapsed ? "w-[72px]" : "w-60"
      }`}
    >
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {MAIN_NAV_ITEMS.map(renderItem)}
        <div role="separator" className="m-3 h-px bg-dash-border" />
        {MORE_NAV_ITEMS.map(renderItem)}
      </nav>

      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Show menu" : undefined}
        title={collapsed ? "Show menu" : undefined}
        className={`mt-auto flex min-h-[44px] items-center gap-2 rounded-[10px] px-3 text-[14px] font-medium text-dash-text-2 ${
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
