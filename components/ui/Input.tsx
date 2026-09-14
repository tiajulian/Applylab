import { InputHTMLAttributes, ReactNode, forwardRef, useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { clsx } from "@/lib/utils";
import { AlertCircleIcon } from "@/components/ui/icons/LucideIcons";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  isHighlighted?: boolean;
  tooltipMessage?: string;
  /** Rendered inside the input box, right-aligned - e.g. a password show/hide toggle. */
  rightElement?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, isHighlighted, tooltipMessage, rightElement, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    return (
      <div className="relative flex flex-col gap-1.5">
        <AnimatePresence>
          {isHighlighted && tooltipMessage && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 2, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
              className="absolute -top-7 right-0 z-30 inline-flex items-center gap-1.5 rounded-lg border border-attention/40 bg-attention-soft px-2.5 py-0.5 text-xs font-semibold text-attention shadow-pop pointer-events-none"
            >
              <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
              <span>{tooltipMessage}</span>
              <div className="absolute -bottom-1 right-4 h-2 w-2 rotate-45 border-b border-r border-attention/40 bg-attention-soft" />
            </motion.div>
          )}
        </AnimatePresence>

        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={clsx(
              "w-full rounded border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted",
              "transition-[border-color,box-shadow] duration-fast ease-editorial",
              "focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring",
              error && "border-critical focus:border-critical focus:ring-critical/20",
              isHighlighted && "animate-pulse-amber border-attention ring-2 ring-attention/40",
              rightElement ? "pr-10" : undefined,
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">{rightElement}</div>
          )}
        </div>
        {error && (
          <p id={errorId} className="text-xs text-critical">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
