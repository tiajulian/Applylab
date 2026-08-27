"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { FollowupModal } from "@/components/dashboard/FollowupModal";
import { ClockIcon, RotateCwIcon, CheckIcon, SparklesIcon } from "@/components/ui/icons/LucideIcons";
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
        <h2 className="font-display text-[19px] font-semibold text-ink flex items-center gap-2">
          <span>Needs you this week</span>
          <span className="flex h-5 items-center justify-center rounded-full bg-accent-soft px-2 text-[11px] font-bold text-accent">
            {items.length}
          </span>
        </h2>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs divide-y divide-border">
        {visibleItems.map((item, index) => {
          const isFollowupAction = item.type === "followup_due" && item.applicationId;
          const isPrimaryAction = index === 0;

          return (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 sm:p-4.5 transition-colors hover:bg-paper/40"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {renderIcon(item.type)}
                <div className="flex flex-col min-w-0">
                  <span className="text-[14.5px] font-semibold text-ink leading-tight">
                    {item.title}
                  </span>
                  <span className="text-[12.5px] text-ink-muted mt-0.5 truncate">
                    {item.subtitle}
                  </span>
                </div>
              </div>

              <div className="flex items-center self-end sm:self-auto shrink-0 ml-auto">
                {isFollowupAction ? (
                  <Button
                    type="button"
                    variant={isPrimaryAction ? "primary" : "outline"}
                    size="sm"
                    onClick={() =>
                      setActiveFollowupModal({
                        applicationId: item.applicationId!,
                        companyName: item.companyName,
                        jobTitle: item.jobTitle,
                      })
                    }
                  >
                    {item.actionLabel.replace(/ →$/, "")} &rarr;
                  </Button>
                ) : item.actionHref ? (
                  <Button
                    href={item.actionHref}
                    variant={isPrimaryAction ? "primary" : "outline"}
                    size="sm"
                  >
                    {item.actionLabel.replace(/ →$/, "")} &rarr;
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
          {isExpanded ? "Show fewer" : `+${remainingCount} more needing attention`}
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
