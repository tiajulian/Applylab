"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FollowupModal } from "@/components/dashboard/FollowupModal";
import { FreeUsesLeft } from "@/components/upgrade/FreeUsesLeft";
import { ClockIcon, RotateCwIcon, CheckIcon, SparklesIcon, ArrowRightIcon } from "@/components/ui/icons/LucideIcons";
import type { AttentionItem } from "@/lib/dashboard/attention";

interface AttentionSectionProps {
  items: AttentionItem[];
}

export function AttentionSection({ items }: AttentionSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeFollowupModal, setActiveFollowupModal] = useState<{
    applicationId: string;
    companyName: string;
    jobTitle: string;
  } | null>(null);

  // When 0 items, emit NO markup at all
  if (items.length === 0) {
    return null;
  }

  const shouldCollapse = items.length >= 3;
  const visibleItems = shouldCollapse && !isExpanded ? items.slice(0, 2) : items;
  const remainingCount = items.length - 2;

  function renderIcon(type: AttentionItem["type"]) {
    switch (type) {
      case "upcoming_interview":
        return (
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <SparklesIcon className="h-4 w-4" />
          </div>
        );
      case "closing_soon":
        return (
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ClockIcon className="h-4 w-4" />
          </div>
        );
      case "followup_due":
        return (
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-paper-deep text-ink-secondary">
            <RotateCwIcon className="h-4 w-4" />
          </div>
        );
      case "outcome_needed":
      default:
        return (
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-paper-deep text-ink-secondary">
            <CheckIcon className="h-4 w-4" />
          </div>
        );
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-ink">
          <span>To do this week</span>
          <span className="flex h-5 items-center justify-center rounded-pill bg-accent-soft px-2 text-[11px] font-bold text-accent">
            {items.length}
          </span>
        </h2>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        {visibleItems.map((item) => {
          const isFollowupAction = item.type === "followup_due" && item.applicationId;

          return (
            <div
              key={item.id}
              className="flex flex-col justify-between gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {renderIcon(item.type)}
                <div className="flex flex-col min-w-0">
                  <span className="text-[15px] font-semibold leading-snug text-ink">
                    {item.title}
                  </span>
                  <span className="mt-0.5 truncate text-[13px] text-ink-muted">
                    {item.subtitle}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center pl-[48px] sm:ml-auto sm:pl-0">
                {isFollowupAction ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-pill"
                    onClick={() =>
                      setActiveFollowupModal({
                        applicationId: item.applicationId!,
                        companyName: item.companyName,
                        jobTitle: item.jobTitle,
                      })
                    }
                  >
                    {item.actionLabel.replace(/ →$/, "")}
                    <FreeUsesLeft feature="followup-draft" /> <ArrowRightIcon className="h-4 w-4" />
                  </Button>
                ) : item.actionHref ? (
                  <Button
                    href={item.actionHref}
                    variant="outline"
                    size="sm"
                    className="rounded-pill"
                  >
                    {item.actionLabel.replace(/ →$/, "")} <ArrowRightIcon className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {shouldCollapse && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="self-start text-xs font-semibold text-ink-secondary hover:text-ink hover:underline pt-0.5"
        >
          {isExpanded ? "Show fewer" : `Show ${remainingCount} more`}
        </button>
      )}

      {activeFollowupModal && (
        <FollowupModal
          isOpen={true}
          onClose={() => setActiveFollowupModal(null)}
          applicationId={activeFollowupModal.applicationId}
          companyName={activeFollowupModal.companyName}
          jobTitle={activeFollowupModal.jobTitle}
        />
      )}
    </section>
  );
}
