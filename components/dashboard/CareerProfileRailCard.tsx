"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { CountUp } from "@/components/ui/CountUp";
import type { ProfileCompletenessResult } from "@/types";

interface CareerProfileRailCardProps {
  completeness: ProfileCompletenessResult;
}

export function CareerProfileRailCard({ completeness }: CareerProfileRailCardProps) {
  const { percent, tasks } = completeness;

  // Spec 07 / 08: Hide when 100% complete
  if (percent >= 100) {
    return null;
  }

  // Show at most 5: up to 3 incomplete tasks, filled with completed tasks for progress
  const incomplete = tasks.filter((t) => !t.done);
  const completed = tasks.filter((t) => t.done);

  const displayTasks = [
    ...incomplete.slice(0, 3),
    ...completed.slice(0, 5 - Math.min(3, incomplete.length)),
  ].slice(0, 5);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
            <CountUp value={percent} suffix="%" />
          </div>
          <span className="font-medium text-ink text-sm">Career profile</span>
        </div>
        <Link
          href="/profile"
          className="text-xs font-medium text-accent hover:text-accent-hover hover:underline"
        >
          Finish profile &rarr;
        </Link>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-2 text-xs">
        {displayTasks.map((task) => (
          <Link
            key={task.id}
            href={task.href}
            className="flex items-start gap-2 rounded p-1 transition-colors hover:bg-paper-deep"
          >
            <span
              className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] text-[10px] ${
                task.done
                  ? "bg-success text-on-accent"
                  : "border border-border-strong bg-surface"
              }`}
            >
              {task.done && "✓"}
            </span>
            <span
              className={
                task.done
                  ? "text-ink-muted line-through"
                  : "font-semibold text-ink hover:text-accent"
              }
            >
              {task.label}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
