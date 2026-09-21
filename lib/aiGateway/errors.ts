import type { Plan } from "@/types";

// Kept free of provider/SDK imports so routes can map these errors without loading the gateway.

export class QuotaExceededError extends Error {
  constructor(
    public readonly tier: Plan,
    public readonly feature: string,
    /** Null for a 'lifetime' tier (free - spec §2): it never resets, so the UI must render the
     * terminal "you've used your free trial" copy from spec §10/§15, never a reset date. */
    public readonly resetsAt: Date | null
  ) {
    super(`AI quota exceeded for tier "${tier}" (feature "${feature}")`);
    this.name = "QuotaExceededError";
  }
}

/** The AI circuit breaker is critical (see breakerGuard.ts): new AI calls are refused. */
export class AiUnavailableError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("AI features are temporarily unavailable");
    this.name = "AiUnavailableError";
  }
}
