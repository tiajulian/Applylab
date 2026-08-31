import { InputHTMLAttributes, ReactNode, forwardRef } from "react";
import { clsx } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Rendered inside the input box, right-aligned - e.g. a password show/hide toggle. */
  rightElement?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, rightElement, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-ink-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={id}
            className={clsx(
              "w-full rounded border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted",
              "transition-[border-color,box-shadow] duration-fast ease-editorial",
              "focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring",
              error && "border-critical focus:border-critical focus:ring-critical/20",
              rightElement ? "pr-10" : undefined,
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">{rightElement}</div>
          )}
        </div>
        {error && <p className="text-xs text-critical">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
