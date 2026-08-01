import { InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-ink-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={clsx(
            "rounded border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted",
            "transition-[border-color,box-shadow] duration-fast ease-editorial",
            "focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring",
            error && "border-critical focus:border-critical focus:ring-critical/20",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-critical">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
