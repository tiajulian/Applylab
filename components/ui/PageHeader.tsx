import type { ReactNode } from "react";
import { clsx } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Job-hunt step (1-4) this page belongs to; shown as the same numbered dot as the sidebar. */
  step?: number;
  /** The page's main action, placed top-right (stacked under the title on phones). */
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, step, action, className }: PageHeaderProps) {
  return (
    <div className={clsx("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6", className)}>
      <div className="min-w-0 max-w-[68ch]">
        <h1 className="flex items-center gap-3 font-display text-[28px] font-semibold leading-[1.15] text-ink sm:text-[32px]">
          {step !== undefined && (
            <>
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-hover font-sans text-[15px] font-bold text-on-accent"
              >
                {step}
              </span>
              <span className="sr-only">Step {step} of 4: </span>
            </>
          )}
          <span>{title}</span>
        </h1>
        {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-ink-secondary">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{action}</div>}
    </div>
  );
}
