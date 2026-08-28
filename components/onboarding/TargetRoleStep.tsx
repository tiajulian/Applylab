"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { clsx } from "@/lib/utils";
import type { TargetRoleCategory } from "@/types";

export interface TargetRoleOption {
  id: TargetRoleCategory;
  icon: string;
  title: string;
  subtext: string;
}

export const TARGET_ROLE_OPTIONS: TargetRoleOption[] = [
  {
    id: "tech",
    icon: "💻",
    title: "Technology & Digital",
    subtext: "Software, Data, Product, IT, Cloud & Cyber",
  },
  {
    id: "healthcare",
    icon: "🏥",
    title: "Healthcare & Clinical",
    subtext: "Nursing, Allied Health, Medical, Care & Support",
  },
  {
    id: "finance_business",
    icon: "📊",
    title: "Finance & Business",
    subtext: "Accounting, Banking, Consulting, Ops & Marketing",
  },
  {
    id: "trades",
    icon: "🔧",
    title: "Trades & Construction",
    subtext: "Building, Electrical, Plumbing, Engineering & Logistics",
  },
  {
    id: "retail_hospitality",
    icon: "🛍️",
    title: "Retail & Hospitality",
    subtext: "Store Management, Customer Service, Food & Events",
  },
  {
    id: "other",
    icon: "✨",
    title: "Other / General",
    subtext: "Education, Public Sector, Creative, Legal & More",
  },
];

interface TargetRoleStepProps {
  initialRole?: TargetRoleCategory | string | null;
  onSelectRole: (role: TargetRoleCategory) => void;
  onBack?: () => void;
}

export function TargetRoleStep({
  initialRole = null,
  onSelectRole,
  onBack,
}: TargetRoleStepProps) {
  const [selectedRole, setSelectedRole] = useState<TargetRoleCategory | null>(
    (initialRole as TargetRoleCategory) || null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleContinue() {
    if (selectedRole && !isSubmitting) {
      setIsSubmitting(true);
      onSelectRole(selectedRole);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-8 rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8"
    >
      {/* Category Tag & Header */}
      <div className="text-center">
        <span className="inline-block rounded-full bg-accent-soft/40 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-accent border border-accent/20">
          TARGET INDUSTRY
        </span>
        <h2 className="mt-3 font-display text-h2 font-bold text-ink">
          What field are you targeting?
        </h2>
        <p className="mt-1.5 text-sm text-ink-secondary">
          We use this to calibrate Australian industry standards, SEEK keywords, and terminology.
        </p>
      </div>

      {/* Role Cards Grid with a11y radiogroup */}
      <div role="radiogroup" aria-label="Select your target industry">
        <StaggerList className="grid gap-4 sm:grid-cols-2">
          {TARGET_ROLE_OPTIONS.map((option) => {
            const isSelected = selectedRole === option.id;
            return (
              <StaggerItem key={option.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setSelectedRole(option.id);
                  }}
                  className={clsx(
                    "group relative flex min-h-[88px] h-full w-full flex-col justify-between rounded-xl border p-5 text-left transition-all duration-fast ease-editorial hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isSelected
                      ? "border-accent bg-accent-soft/30 ring-2 ring-accent/30 shadow-sm"
                      : "border-border bg-paper hover:border-accent/50 hover:bg-paper-deep"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl" role="img" aria-label={option.title}>
                        {option.icon}
                      </span>
                      <span className="font-display text-base font-bold text-ink group-hover:text-accent transition-colors">
                        {option.title}
                      </span>
                    </div>
                    {isSelected && (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent shadow-xs"
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-ink-secondary leading-relaxed">
                    {option.subtext}
                  </p>
                </button>
              </StaggerItem>
            );
          })}
        </StaggerList>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between border-t border-border pt-5">
        {onBack ? (
          <button
            type="button"
            className="rounded text-sm text-ink-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onBack}
          >
            ← Back
          </button>
        ) : (
          <span className="text-xs text-ink-muted">Single-tap selection</span>
        )}
        <Button
          type="button"
          size="md"
          disabled={!selectedRole || isSubmitting}
          onClick={handleContinue}
        >
          {isSubmitting ? "Saving..." : "Continue →"}
        </Button>
      </div>
    </motion.div>
  );
}
