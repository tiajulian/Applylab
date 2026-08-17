import { SelectHTMLAttributes, forwardRef } from "react";
import { clsx } from "@/lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-ink-secondary">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={clsx(
            "rounded border border-border bg-surface px-3.5 py-2.5 text-sm text-ink",
            "transition-[border-color,box-shadow] duration-fast ease-editorial",
            "focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-critical focus:border-critical focus:ring-critical/20",
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-critical">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
