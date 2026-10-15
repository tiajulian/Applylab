import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons/LucideIcons";
import type { ProfileCompletenessResult } from "@/types";

interface CareerProfileRailCardProps {
  completeness: ProfileCompletenessResult;
}

/** How complete the profile is, and the next few things to add - each one a direct link. */
export function CareerProfileRailCard({ completeness }: CareerProfileRailCardProps) {
  const { percent, nextTasks: todo } = completeness;

  return (
    <section
      aria-labelledby="profile-progress"
      className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface p-5 shadow-sm"
    >
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="profile-progress" className="text-[15px] font-semibold text-ink">
            Your profile
          </h2>
          <span className="text-[13px] font-semibold tabular-nums text-ink-secondary">{percent}% done</span>
        </div>
        <div
          className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-paper-deep"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Profile completeness"
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-secondary">
          The more you add, the better your resumes. Add next:
        </p>
      </div>

      <ul className="flex flex-col">
        {todo.map((task) => (
          <li key={task.id}>
            <Link
              href={task.href}
              className="group -mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-2 text-[13.5px] font-medium text-ink transition-colors duration-fast hover:bg-paper-deep"
            >
              <span className="flex items-center gap-2.5">
                <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full border-2 border-border-strong" />
                {task.label}
              </span>
              <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform duration-fast group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/profile"
        className="inline-flex h-9 items-center justify-center rounded-pill border border-border-strong text-sm font-medium text-ink transition-colors duration-fast hover:bg-paper-deep"
      >
        Open your profile
      </Link>
    </section>
  );
}
