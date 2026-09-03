"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useTour } from "@/components/tour/TourContext";
import { FeedbackModal } from "@/components/feedback/FeedbackModal";
import {
  BookOpenIcon,
  ChevronDownIcon,
  CompassIcon,
  CreditCardIcon,
  LogOutIcon,
  MessageSquareIcon,
  PuzzleIcon,
  ShieldCheckIcon,
} from "@/components/ui/icons/LucideIcons";
import type { Plan } from "@/types";

export interface UserMenuProps {
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
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

function MenuLink({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-ink-secondary transition-colors hover:bg-paper-deep hover:text-ink"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-ink-muted">{icon}</span>
      <span>{children}</span>
    </Link>
  );
}

function MenuButton({
  icon,
  children,
  onClick,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-ink-secondary transition-colors hover:bg-paper-deep hover:text-ink"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-ink-muted">{icon}</span>
      <span>{children}</span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{children}</p>
  );
}

// useTour() requires a TourProvider ancestor, which only wraps the dashboard shell. Isolated in
// its own component (rather than called at the top of UserAvatarMenu) so it's only invoked when
// this menu item is actually rendered — UserAvatarMenu itself is also used on public marketing
// pages, outside any TourProvider, where the dashboard feature tour doesn't apply anyway.
function TourMenuButton({ onNavigate }: { onNavigate: () => void }) {
  const { startTour } = useTour();
  return (
    <MenuButton
      icon={<CompassIcon />}
      onClick={() => {
        onNavigate();
        startTour(0);
      }}
    >
      Take Feature Tour
    </MenuButton>
  );
}

// Probed client-side (rather than trusting a server-rendered <img>'s onError) because
// the "error" event on <img> doesn't bubble: if it fires before hydration attaches
// React's listener, the event is lost and the browser's broken-image icon sticks.
// Lifted out of Avatar so the trigger and dropdown-header avatars share one probe
// instead of each re-checking (and flashing initials) whenever the dropdown opens.
function useConfirmedAvatarUrl(avatarUrl?: string | null): string | null {
  const [confirmedUrl, setConfirmedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarUrl) {
      setConfirmedUrl(null);
      return;
    }
    let cancelled = false;
    const probe = new window.Image();
    probe.referrerPolicy = "no-referrer";
    probe.onload = () => {
      if (!cancelled) setConfirmedUrl(avatarUrl);
    };
    probe.onerror = () => {
      if (!cancelled) setConfirmedUrl(null);
    };
    probe.src = avatarUrl;
    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  return confirmedUrl;
}

function Avatar({
  confirmedUrl,
  initials,
  className,
  textClassName = "text-xs font-semibold",
}: {
  confirmedUrl: string | null;
  initials: string;
  className: string;
  textClassName?: string;
}) {
  if (confirmedUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={confirmedUrl} alt="" className={`${className} object-cover`} referrerPolicy="no-referrer" />
    );
  }

  return (
    <span
      className={`${className} flex items-center justify-center border border-border bg-accent ${textClassName} text-on-accent`}
    >
      {initials}
    </span>
  );
}

export function UserAvatarMenu({
  user,
  showTourEntry = true,
}: {
  user: UserMenuProps;
  /** Hide "Take Feature Tour" outside the dashboard shell, where TourProvider isn't mounted. */
  showTourEntry?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const initials = getInitials(user.fullName, user.email);
  const displayName = user.fullName?.trim() || "Account";
  const confirmedAvatarUrl = useConfirmedAvatarUrl(user.avatarUrl);

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
        className="group flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 transition-colors duration-fast ease-editorial hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="User profile menu"
        aria-expanded={isOpen}
      >
        <Avatar
          confirmedUrl={confirmedAvatarUrl}
          initials={initials}
          className="h-9 w-9 rounded-full shadow-sm ring-2 ring-transparent transition-all duration-fast ease-editorial group-hover:ring-accent-soft"
        />
        <ChevronDownIcon
          className={`hidden h-3.5 w-3.5 text-ink-muted transition-transform duration-fast ease-editorial sm:block ${
            isOpen ? "rotate-180" : ""
          }`}
        />
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
              <Avatar
                confirmedUrl={confirmedAvatarUrl}
                initials={initials}
                className="h-10 w-10 shrink-0 rounded-full"
                textClassName="text-sm font-bold"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
                  <PlanBadge plan={user.plan} />
                </div>
                <p className="truncate text-xs text-ink-secondary">{user.email}</p>
              </div>
            </div>

            <div className="my-1.5 h-px bg-border" />

            {/* Account */}
            <div className="flex flex-col gap-0.5 text-sm">
              <SectionLabel>Account</SectionLabel>
              <MenuLink href="/upgrade" icon={<CreditCardIcon />} onClick={handleNavigate}>
                Subscription &amp; Plan
              </MenuLink>
              {user.isAdmin && (
                <MenuLink href="/admin" icon={<ShieldCheckIcon />} onClick={handleNavigate}>
                  Admin Workspace
                </MenuLink>
              )}
            </div>

            <div className="my-1.5 h-px bg-border" />

            {/* Resources */}
            <div className="flex flex-col gap-0.5 text-sm">
              <SectionLabel>Resources</SectionLabel>
              <MenuLink href="/extension" icon={<PuzzleIcon />} onClick={handleNavigate}>
                Chrome Extension Setup
              </MenuLink>
              <MenuLink href="/blog" icon={<BookOpenIcon />} onClick={handleNavigate}>
                Career Guides &amp; Blog
              </MenuLink>
              {showTourEntry && <TourMenuButton onNavigate={handleNavigate} />}
              <MenuButton
                icon={<MessageSquareIcon />}
                onClick={() => {
                  setIsOpen(false);
                  setIsFeedbackOpen(true);
                }}
              >
                Send Feedback
              </MenuButton>
            </div>

            <div className="my-1.5 h-px bg-border" />

            {/* Logout Action */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-critical transition-colors hover:bg-critical-soft/50"
            >
              <LogOutIcon className="h-4 w-4 text-critical" />
              Log Out
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {isFeedbackOpen && <FeedbackModal onClose={() => setIsFeedbackOpen(false)} />}
    </div>
  );
}
