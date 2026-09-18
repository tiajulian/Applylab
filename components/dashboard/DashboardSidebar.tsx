"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { GuardedLink } from "@/components/dashboard/GuardedLink";
import { SIDEBAR_NAV_ITEMS } from "@/components/dashboard/sidebarNavItems";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons/LucideIcons";
import type { PipelineCounts } from "@/lib/dashboard/pipeline";

const PIPELINE_STAGE_COUNT = 5; // drafted, applied, screening, interview, offer
const STORAGE_KEY = "applylab_sidebar_collapsed";

export function DashboardSidebar({
  pipelineCounts,
  isFreePlan,
}: {
  pipelineCounts: PipelineCounts;
  isFreePlan: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, String(next));
      }
      return next;
    });
  }

  const isActive = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href));

  const activeStages = [
    pipelineCounts.drafted,
    pipelineCounts.applied,
    pipelineCounts.screening,
    pipelineCounts.interview,
    pipelineCounts.offer,
  ].filter((count) => count > 0).length;

  return (
    <aside
      className={`hidden shrink-0 border-r border-border bg-paper py-5 transition-[width] duration-fast ease-editorial lg:sticky lg:top-[67px] lg:flex lg:h-[calc(100vh-67px)] lg:flex-col ${
        collapsed ? "w-16 px-2" : "w-56 px-3"
      }`}
    >
      <nav className="flex flex-col gap-1">
        {SIDEBAR_NAV_ITEMS.map(({ label, href, icon: Icon, dataTour, disabled }) =>
          disabled ? (
            <span
              key={label}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted/60 ${
                collapsed ? "justify-center" : ""
              }`}
              title={collapsed ? `${label} (coming soon)` : "Coming soon"}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{label}</span>
                  <span className="rounded-pill bg-paper-deep px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                    Soon
                  </span>
                </>
              )}
            </span>
          ) : (
            <GuardedLink
              key={label}
              href={href}
              data-tour={dataTour}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-fast ease-editorial ${
                collapsed ? "justify-center" : ""
              } ${
                isActive(href)
                  ? "bg-accent-soft font-semibold text-accent"
                  : "font-medium text-ink-secondary hover:bg-paper-deep hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{label}</span>
                  {href === "/interview" && isFreePlan && (
                    <span className="rounded-pill bg-accent px-1.5 py-0.5 text-[10px] font-semibold leading-none text-on-accent">
                      Pro
                    </span>
                  )}
                </>
              )}
            </GuardedLink>
          )
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-secondary transition-colors duration-fast ease-editorial hover:bg-paper-deep hover:text-ink ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {collapsed ? (
            <ChevronRightIcon className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <ChevronLeftIcon className="h-4 w-4 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>

        {!collapsed && (
          <div className="rounded-xl border border-border/90 bg-surface p-3.5">
            <p className="text-xs font-semibold text-ink">
              {activeStages === 0 ? "Let's get your first application in!" : "Your job search is on track!"}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-paper-deep">
              <div
                className="h-full rounded-pill bg-accent transition-[width] duration-fast ease-editorial"
                style={{ width: `${(activeStages / PIPELINE_STAGE_COUNT) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-ink-muted">
              {activeStages} / {PIPELINE_STAGE_COUNT} active stages
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
