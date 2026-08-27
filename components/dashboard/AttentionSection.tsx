"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FollowupModal } from "@/components/dashboard/FollowupModal";
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

  // Spec 03 / 08: When 0 items, emit NO markup at all
  if (items.length === 0) {
    return null;
  }

  const shouldCollapse = items.length >= 3;
  const visibleItems = shouldCollapse && !isExpanded ? items.slice(0, 2) : items;
  const remainingCount = items.length - 2;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-ink flex items-center gap-2">
          <span>Needs attention</span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-attention-soft text-[11px] font-bold text-attention">
            {items.length}
          </span>
        </h2>
      </div>

      <div className="flex flex-col gap-2.5">
        {visibleItems.map((item) => {
          const isFollowupAction = item.type === "followup_due" && item.applicationId;

          return (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5 transition-[border-color,box-shadow] hover:border-border-strong"
            >
              <div className="flex items-start gap-3">
                <Badge variant={item.badgeVariant}>
                  {item.badgeLabel}
                </Badge>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-ink">{item.title}</span>
                  <span className="text-xs text-ink-secondary">{item.subtitle}</span>
                </div>
              </div>

              <div className="flex items-center self-end sm:self-auto">
                {isFollowupAction ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setActiveFollowupModal({
                        applicationId: item.applicationId!,
                        companyName: item.companyName,
                        jobTitle: item.jobTitle,
                      })
                    }
                  >
                    {item.actionLabel}
                  </Button>
                ) : item.actionHref ? (
                  <Link
                    href={item.actionHref}
                    className="inline-flex items-center text-xs font-semibold text-accent transition-colors hover:text-accent-hover hover:underline"
                  >
                    {item.actionLabel}
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}

        {shouldCollapse && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="self-start text-xs font-medium text-ink-secondary hover:text-ink hover:underline pt-1"
          >
            {isExpanded ? "Show fewer" : `+${remainingCount} more needing attention`}
          </button>
        )}
      </div>

      {activeFollowupModal && (
        <FollowupModal
          isOpen={true}
          onClose={() => setActiveFollowupModal(null)}
          applicationId={activeFollowupModal.applicationId}
          companyName={activeFollowupModal.companyName}
          jobTitle={activeFollowupModal.jobTitle}
        />
      )}
    </div>
  );
}
