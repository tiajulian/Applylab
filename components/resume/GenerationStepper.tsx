import { clsx } from "@/lib/utils";

const STEPS = ["Target job", "Confirm your match", "Review & edit"];

export function GenerationStepper({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Resume generation progress">
      <p className="text-xs font-medium text-ink-secondary sm:hidden">
        Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1]}
      </p>
      <ol className="hidden items-center gap-2 text-xs sm:flex">
        {STEPS.map((label, idx) => {
          const step = idx + 1;
          const isComplete = step < currentStep;
          const isCurrent = step === currentStep;

          return (
            <li key={label} className="flex items-center gap-2">
              {idx > 0 && <span className="h-px w-6 bg-border" aria-hidden="true" />}
              <span
                className={clsx(
                  "flex items-center gap-1.5 rounded-pill px-2.5 py-1 font-medium",
                  isCurrent
                    ? "bg-accent-soft text-accent"
                    : isComplete
                    ? "text-success"
                    : "text-ink-muted"
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span aria-hidden="true">{isComplete ? "✓" : step}</span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
