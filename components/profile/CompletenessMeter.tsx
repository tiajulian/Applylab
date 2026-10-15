import type { ProfileCompletenessResult } from "@/types";

/** Profile progress plus the next two things to add, each jumping to its section on this page. */
export function CompletenessMeter({ completeness }: { completeness: ProfileCompletenessResult }) {
  const { percent } = completeness;
  const todo = completeness.nextTasks.slice(0, 2);

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold text-ink">
          {percent === 100 ? "Your profile is complete" : `Your profile is ${percent}% done`}
        </span>
        <span className="text-[13px] tabular-nums text-ink-muted">{percent}%</span>
      </div>
      <div
        className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-paper-deep"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Profile completeness"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${percent === 100 ? "bg-success" : "bg-accent"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {todo.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13.5px] text-ink-secondary">
          <span>Add next:</span>
          {todo.map((task, i) => (
            <span key={task.id}>
              <a
                href={task.href.replace(/^\/profile/, "")}
                className="font-medium text-accent-hover underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
              >
                {task.label}
              </a>
              {i < todo.length - 1 && <span aria-hidden="true">,</span>}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
