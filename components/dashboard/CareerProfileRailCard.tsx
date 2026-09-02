"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons/LucideIcons";
import type { ProfileCompletenessResult } from "@/types";

interface CareerProfileRailCardProps {
  completeness: ProfileCompletenessResult;
}

export function CareerProfileRailCard({ completeness }: CareerProfileRailCardProps) {
  const { percent, tasks } = completeness;

  // Show at most 5: up to 3 incomplete tasks, filled with completed tasks for progress
  const incomplete = tasks.filter((t) => !t.done);
  const completed = tasks.filter((t) => t.done);

  const displayTasks = [
    ...incomplete.slice(0, 3),
    ...completed.slice(0, 5 - Math.min(3, incomplete.length)),
  ].slice(0, 5);

  const radius = 33;
  const circumference = 2 * Math.PI * radius; // ~207.345
  const strokeDashoffset = circumference - (percent / 100) * circumference;
  const showRing = percent >= 10;
  const isComplete = percent === 100;

  return (
    <div className="flex flex-col gap-4.5 rounded-lg border border-border bg-surface p-5 shadow-pop">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent">
          CAREER PROFILE
        </span>
        {isComplete && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-success bg-success-soft px-2 py-0.5 rounded-full">
            All Set
          </span>
        )}
      </div>

      {showRing ? (
        /* Progress Ring & Description */
        <div className="flex items-center gap-4">
          <div
            className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-paper-deep/30"
            role="img"
            aria-label={`Career profile is ${percent}% complete`}
          >
            <svg className="h-20 w-20 -rotate-90 transform" viewBox="0 0 80 80">
              {/* Background Track */}
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                stroke="var(--border)"
                strokeWidth="5.5"
                opacity="0.8"
              />
              {/* Progress Arc */}
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                stroke={isComplete ? "var(--success)" : "var(--accent)"}
                strokeWidth="5.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-[stroke-dashoffset] duration-700 ease-out"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
              <span className="font-sans text-[20px] font-bold tracking-tight text-ink leading-none">
                {percent}%
              </span>
              <span className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted leading-none">
                Complete
              </span>
            </div>
          </div>

          <p className="text-[13px] text-ink-secondary leading-relaxed">
            Every match score and tailored resume anchors to your confirmed facts.
          </p>
        </div>
      ) : (
        /* Zero / Low state (< 10%): lead with task description directly */
        <p className="text-[13px] text-ink-secondary leading-relaxed">
          Every match score and tailored resume anchors to your confirmed facts. Start by completing your key details:
        </p>
      )}

      {/* 5-Item Checklist */}
      <div className="flex flex-col gap-2.5 pt-1">
        {displayTasks.map((task) => (
          <Link
            key={task.id}
            href={task.href}
            className="flex items-start gap-2.5 rounded py-0.5 transition-colors hover:text-accent"
          >
            {task.done ? (
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-success text-on-accent">
                <CheckIcon className="h-3 w-3" />
              </span>
            ) : (
              <span className="mt-0.5 flex h-4 w-4 shrink-0 rounded border-2 border-border-strong bg-surface" />
            )}
            <span
              className={
                task.done
                  ? "text-xs text-ink-muted line-through"
                  : "text-xs font-semibold text-ink"
              }
            >
              {task.label}
            </span>
          </Link>
        ))}
      </div>

      <Button href="/profile" size="md" className="mt-1 w-full justify-center rounded-pill">
        {isComplete ? "View profile →" : "Finish profile →"}
      </Button>
    </div>
  );
}
