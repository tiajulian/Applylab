"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquareIcon, TrendingUpIcon, UsersIcon } from "@/components/ui/icons/LucideIcons";

export function AdminNavTabs() {
  const pathname = usePathname();

  const isAnalytics = pathname === "/admin" || pathname === "/admin/analytics";
  const isUsers = pathname === "/admin/users";
  const isFeedback = pathname === "/admin/feedback";

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-paper-deep p-1">
      <Link
        href="/admin/analytics"
        className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-fast ${
          isAnalytics
            ? "bg-surface text-ink shadow-sm border border-border/80"
            : "text-ink-secondary hover:text-ink hover:bg-paper"
        }`}
      >
        <TrendingUpIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Executive Analytics</span>
      </Link>
      <Link
        href="/admin/users"
        className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-fast ${
          isUsers
            ? "bg-surface text-ink shadow-sm border border-border/80"
            : "text-ink-secondary hover:text-ink hover:bg-paper"
        }`}
      >
        <UsersIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>User Accounts &amp; Comps</span>
      </Link>
      <Link
        href="/admin/feedback"
        className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-fast ${
          isFeedback
            ? "bg-surface text-ink shadow-sm border border-border/80"
            : "text-ink-secondary hover:text-ink hover:bg-paper"
        }`}
      >
        <MessageSquareIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Feedback Inbox</span>
      </Link>
    </div>
  );
}
