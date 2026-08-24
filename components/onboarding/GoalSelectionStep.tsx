"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { clsx } from "@/lib/utils";
import type { CareerGoal } from "@/types";

export interface GoalOption {
  id: CareerGoal;
  icon: string;
  title: string;
  subtext: string;
}

export const CAREER_GOAL_OPTIONS: GoalOption[] = [
  {
    id: "career_transition",
    icon: "🔄",
    title: "Transition to a new career or industry",
    subtext: "Re-frame transferable skills for a new field",
  },
  {
    id: "first_job",
    icon: "🎓",
    title: "Land my first job or graduate role",
    subtext: "Highlight education, projects, and foundational skills",
  },
  {
    id: "better_company",
    icon: "🚀",
    title: "Switch to a better company",
    subtext: "Showcase proven experience and modern tools",
  },
  {
    id: "level_up_senior",
    icon: "📈",
    title: "Level up to a senior or lead role",
    subtext: "Emphasize leadership, architecture, and scope",
  },
  {
    id: "break_into_tech",
    icon: "💻",
    title: "Break into tech or corporate",
    subtext: "Translate casual or non-tech experience into corporate language",
  },
  {
    id: "exploring",
    icon: "🔍",
    title: "Just exploring for now",
    subtext: "See how my current resume benchmarks",
  },
];

interface GoalSelectionStepProps {
  userFirstName?: string;
  initialGoal?: CareerGoal | null;
  onSelectGoal: (goal: CareerGoal) => void;
}

export function GoalSelectionStep({
  userFirstName,
  initialGoal = null,
  onSelectGoal,
}: GoalSelectionStepProps) {
  const [selectedGoal, setSelectedGoal] = useState<CareerGoal | null>(initialGoal);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cleanName =
    userFirstName && userFirstName !== "undefined" && userFirstName !== "null"
      ? userFirstName.trim()
      : "";
  const firstName = cleanName ? cleanName.split(" ")[0] : "";
  const headline = firstName
    ? `${firstName}, what are you here to do?`
    : "What are you here to do?";

  function handleContinue() {
    if (selectedGoal && !isSubmitting) {
      setIsSubmitting(true);
      onSelectGoal(selectedGoal);
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
      {/* Category Tag & Personalized Header */}
      <div className="text-center">
        <span className="inline-block rounded-full bg-accent-soft/40 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-accent border border-accent/20">
          YOUR GOAL
        </span>
        <h2 className="mt-3 font-display text-h2 font-bold text-ink">
          {headline}
        </h2>
        <p className="mt-1.5 text-sm text-ink-secondary">
          We&apos;ll tailor your duty suggestions, skills bridge, and resume positioning to match your exact objective.
        </p>
      </div>

      {/* 6 Goal Cards Grid with a11y radiogroup */}
      <div role="radiogroup" aria-label="Select your career goal">
        <StaggerList className="grid gap-4 sm:grid-cols-2">
          {CAREER_GOAL_OPTIONS.map((option) => {
            const isSelected = selectedGoal === option.id;
            return (
              <StaggerItem key={option.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setSelectedGoal(option.id);
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
        <span className="text-xs text-ink-muted">
          Select an option to personalize your AI engine
        </span>
        <Button
          type="button"
          size="md"
          disabled={!selectedGoal || isSubmitting}
          onClick={handleContinue}
        >
          {isSubmitting ? "Saving..." : "Continue →"}
        </Button>
      </div>
    </motion.div>
  );
}
