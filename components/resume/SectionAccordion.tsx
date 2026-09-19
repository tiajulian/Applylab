"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckIcon,
  ChevronDownIcon,
} from "@/components/ui/icons/LucideIcons";

export type SectionPipState = "done" | "flagged" | "empty";

export interface SectionAccordionProps {
  id: string;
  title: string;
  summary: string;
  pipState: SectionPipState;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  headerAction?: ReactNode;
}

export function SectionAccordion({
  id,
  title,
  summary,
  pipState,
  isOpen,
  onToggle,
  children,
  headerAction,
}: SectionAccordionProps) {
  return (
    <div
      id={`section-${id}`}
      className={`rounded-xl border transition-all duration-fast ease-editorial ${
        isOpen
          ? "border-accent/40 bg-surface shadow-xs"
          : "border-border/80 bg-surface/70 hover:border-border hover:bg-surface"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`section-content-${id}`}
        className="flex w-full items-center justify-between gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Pip */}
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
            {pipState === "done" && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-soft text-success">
                <CheckIcon className="h-3 w-3" strokeWidth={2.75} />
              </span>
            )}
            {pipState === "flagged" && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft font-bold text-accent text-xs">
                !
              </span>
            )}
            {pipState === "empty" && (
              <span className="h-4 w-4 rounded-full border border-border" />
            )}
          </div>

          {/* Titles */}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-ink leading-tight">
              {title}
            </span>
            <span className="text-xs text-ink-muted truncate mt-0.5">
              {summary}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {headerAction && (
            <div onClick={(e) => e.stopPropagation()}>{headerAction}</div>
          )}
          <ChevronDownIcon
            className={`h-4 w-4 text-ink-muted transition-transform duration-fast ease-editorial ${
              isOpen ? "rotate-180 text-ink" : ""
            }`}
            strokeWidth={2.75}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`section-content-${id}`}
            role="region"
            aria-labelledby={`section-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60 p-4 pt-4 sm:p-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
