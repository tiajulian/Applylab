"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useTour } from "@/components/tour/TourContext";
import { FeedbackModal } from "@/components/feedback/FeedbackModal";
import type { Plan } from "@/types";

export interface UserMenuProps {
  email: string;
  fullName?: string | null;
  plan: Plan;
  isAdmin?: boolean;
}

function getInitials(name?: string | null, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return "U";
}

function PlanBadge({ plan }: { plan: Plan }) {
  if (plan === "pro") {
    return (
      <span className="rounded border border-accent/30 bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
        Pro Plan
      </span>
    );
  }
  if (plan === "lifetime") {
    return (
      <span className="rounded bg-accent px-2 py-0.5 text-[11px] font-semibold text-on-accent">
        Lifetime
      </span>
    );
  }
  return (
    <span className="rounded border border-border bg-paper-deep px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
      Free Plan
    </span>
  );
}

export function UserAvatarMenu({ user }: { user: UserMenuProps }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const { startTour } = useTour();
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const initials = getInitials(user.fullName, user.email);
  const displayName = user.fullName?.trim() || "Account";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function handleLogout() {
    setIsOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function handleNavigate() {
    setIsOpen(false);
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-accent text-xs font-semibold text-on-accent shadow-sm transition-all duration-fast ease-editorial hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="User profile menu"
        aria-expanded={isOpen}
      >
        {initials}
      </button>

      {/* Floating Dropdown Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-72 origin-top-right rounded-lg border border-border bg-surface p-2 shadow-pop"
          >
            {/* Identity Header */}
            <div className="flex items-center gap-3 rounded-md bg-paper-deep/50 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
                  <PlanBadge plan={user.plan} />
                </div>
                <p className="truncate text-xs text-ink-secondary">{user.email}</p>
              </div>
            </div>

            <div className="my-1.5 h-px bg-border" />

            {/* Navigation / Account Items */}
            <div className="flex flex-col gap-0.5 text-sm">
              <Link
                href="/upgrade"
                onClick={handleNavigate}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-ink-secondary transition-colors hover:bg-paper-deep hover:text-ink"
              >
                <svg className="h-4 w-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Subscription & Plan</span>
              </Link>

              <Link
                href="/extension"
                onClick={handleNavigate}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-ink-secondary transition-colors hover:bg-paper-deep hover:text-ink"
              >
                <span className="text-sm">🧩</span>
                <span>Chrome Extension Setup</span>
              </Link>

              <Link
                href="/blog"
                onClick={handleNavigate}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-ink-secondary transition-colors hover:bg-paper-deep hover:text-ink"
              >
                <span className="text-sm">📚</span>
                <span>Career Guides &amp; Blog</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  startTour(0);
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-ink-secondary transition-colors hover:bg-paper-deep hover:text-ink"
              >
                <span className="text-sm">🧭</span>
                <span>Take Feature Tour</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsFeedbackOpen(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-ink-secondary transition-colors hover:bg-paper-deep hover:text-ink"
              >
                <span className="text-sm">💬</span>
                <span>Send Feedback</span>
              </button>

              {user.isAdmin && (
                <Link
                  href="/admin"
                  onClick={handleNavigate}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-ink-secondary transition-colors hover:bg-paper-deep hover:text-ink"
                >
                  <svg className="h-4 w-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Admin Workspace</span>
                </Link>
              )}
            </div>

            <div className="my-1.5 h-px bg-border" />

            {/* Logout Action */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-critical transition-colors hover:bg-critical-soft/50"
            >
              <svg className="h-4 w-4 text-critical" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Log Out
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {isFeedbackOpen && <FeedbackModal onClose={() => setIsFeedbackOpen(false)} />}
    </div>
  );
}
