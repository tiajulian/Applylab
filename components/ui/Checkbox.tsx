import { InputHTMLAttributes, ReactNode, forwardRef } from "react";
import { clsx } from "@/lib/utils";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-secondary">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            className={clsx(
              "mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-border-strong accent-accent",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-paper",
              error && "border-critical",
              className
            )}
            {...props}
          />
          <span>{label}</span>
        </label>
        {error && <p className="text-xs text-critical">{error}</p>}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";
