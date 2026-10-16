"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { GuardedLink } from "@/components/dashboard/GuardedLink";
import {
  HOME_NAV_ITEM,
  MORE_NAV_ITEMS,
  STEP_NAV_ITEMS,
  isNavItemActive,
  type SidebarNavItem,
} from "@/components/dashboard/sidebarNavItems";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons/LucideIcons";

const STORAGE_KEY = "applylab_sidebar_collapsed";

export function DashboardSidebar({ isFreePlan }: { isFreePlan: boolean }) {
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
    const showPro = item.proOnly && isFreePlan;

    return (
      <GuardedLink
        key={item.href}
        href={item.href}
        data-tour={item.dataTour}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors duration-fast ease-editorial ${
          collapsed ? "justify-center" : ""
        } ${active ? "bg-accent-soft" : "hover:bg-paper-deep"}`}
      >
        {item.step ? (
          <span
            aria-hidden="true"
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold tabular-nums transition-colors duration-fast ${
              active
                ? "bg-accent-hover text-on-accent"
                : "border border-border-strong bg-surface text-ink-secondary group-hover:border-ink-muted"
            }`}
          >
            {item.step}
          </span>
        ) : (
          <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center">
            <Icon className={`h-4 w-4 ${active ? "text-accent" : "text-ink-secondary"}`} />
          </span>
        )}
        {!collapsed && (
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-1.5">
              <span className={`truncate text-[13.5px] ${active ? "font-semibold text-accent-hover" : "font-medium text-ink"}`}>
                {item.label}
              </span>
              {showPro && (
                <span className="rounded-pill bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold leading-none text-accent-hover">
                  Pro
                </span>
              )}
            </span>
            <span className="truncate text-[11.5px] leading-snug text-ink-muted">{item.hint}</span>
          </span>
        )}
      </GuardedLink>
    );
  }

  return (
    <aside
      aria-label="Main"
      className={`hidden shrink-0 border-r border-border py-5 transition-[width] duration-fast ease-editorial lg:sticky lg:top-[69px] lg:flex lg:h-[calc(100dvh-69px)] lg:flex-col lg:overflow-y-auto ${
        collapsed ? "w-[60px] px-2" : "w-60 pl-0 pr-3"
      }`}
    >
      <nav className="flex flex-col gap-1">
        {renderItem(HOME_NAV_ITEM)}

        {!collapsed && (
          <p className="mt-4 mb-0.5 px-2.5 text-[11.5px] font-semibold text-ink-muted">Your job hunt, step by step</p>
        )}
        {collapsed && <div className="my-3 h-px bg-border" aria-hidden="true" />}
        {STEP_NAV_ITEMS.map(renderItem)}

        {!collapsed && <p className="mt-4 mb-0.5 px-2.5 text-[11.5px] font-semibold text-ink-muted">More tools</p>}
        {collapsed && <div className="my-3 h-px bg-border" aria-hidden="true" />}
        {MORE_NAV_ITEMS.map(renderItem)}
      </nav>

      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={`mt-auto flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-muted transition-colors duration-fast ease-editorial hover:bg-paper-deep hover:text-ink ${
          collapsed ? "justify-center" : ""
        }`}
      >
        {collapsed ? (
          <ChevronRightIcon className="h-4 w-4 shrink-0" />
        ) : (
          <>
            <ChevronLeftIcon className="h-4 w-4 shrink-0" />
            <span>Hide menu</span>
          </>
        )}
      </button>
    </aside>
  );
}
