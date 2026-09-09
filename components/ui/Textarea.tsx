import { TextareaHTMLAttributes, forwardRef, useId } from "react";
import { clsx } from "@/lib/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const autoId = useId();
    const textareaId = id ?? autoId;
    const errorId = `${textareaId}-error`;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-ink-secondary">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={clsx(
            "rounded border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted",
            "transition-[border-color,box-shadow] duration-fast ease-editorial",
            "focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring",
            error && "border-critical focus:border-critical focus:ring-critical/20",
            className
          )}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs text-critical">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
