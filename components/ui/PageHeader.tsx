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
    <div className={clsx("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6", className)}>
      <div className="min-w-0 max-w-[68ch]">
        <h1 className="flex items-center gap-2.5 font-display text-[22px] font-semibold leading-[1.2] text-ink sm:text-[26px]">
          {step !== undefined && (
            <>
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent font-sans text-[13px] font-bold text-on-accent"
              >
                {step}
              </span>
              <span className="sr-only">Step {step} of 4: </span>
            </>
          )}
          <span>{title}</span>
        </h1>
        {subtitle && <p className="mt-1 text-[14px] leading-relaxed text-ink-secondary">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{action}</div>}
    </div>
  );
}
