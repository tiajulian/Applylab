"use client";

import { ProCheckoutButtons } from "@/components/upgrade/ProCheckoutButtons";

interface LimitReachedInlineProps {
  title: string;
  message: string;
}

/**
 * Same copy/CTA as LimitReachedModal, but rendered inline instead of as a second overlay - for
 * the handful of call sites (FollowupModal, WinBuilder, GuidedProjectBuilderModal) that are
 * themselves already an open modal. Stacking a full-screen popup on top of an already-open modal
 * is a real UX anti-pattern (disorienting, unclear what closing it returns to) - showing the
 * limit as a terminal state inside the modal that's already focused is the better pattern here.
 * Amber/attention styling, not critical/red: hitting a free-tier limit is an expected boundary,
 * not a system failure, and shouldn't read as something broken.
 */
export function LimitReachedInline({ title, message }: LimitReachedInlineProps) {
  return (
    // role="status": it replaces the modal's content after an action, so screen readers announce it.
    <div role="status" className="rounded-lg border border-attention/30 bg-attention-soft p-4 text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-attention/30 bg-surface px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-attention">
        FREE PLAN LIMIT
      </span>
      <h4 className="mt-2.5 text-balance font-display text-sm font-bold text-ink">{title}</h4>
      <p className="mx-auto mt-1 max-w-[22rem] text-pretty text-sm text-ink-secondary">{message}</p>
      <div className="mt-4">
        <ProCheckoutButtons size="sm" />
      </div>
    </div>
  );
}
