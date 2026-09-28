import { timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { AdzunaClient } from "@/lib/jobs/adzuna/client";
import { createSupabaseCallBudget } from "@/lib/jobs/adzuna/supabaseBudget";
import { getAdzunaConfig, getIngestConfig } from "@/lib/jobs/config";
import { runIngestion, type IngestOptions, type IngestResult } from "@/lib/jobs/ingestion/ingest";
import { createSupabaseIngestStore } from "@/lib/jobs/ingestion/store";

// Ceiling for a manual maxCalls override: Adzuna's default daily limit.
export const MAX_CALLS_OVERRIDE_LIMIT = 250;

// Reuses the existing ops webhook (see lib/aiGateway/breakerGuard.ts) - the only alerting we have.
async function alertOps(message: string): Promise<void> {
  console.error(message);
  const webhook = process.env.AI_BREAKER_ALERT_WEBHOOK_URL;
  if (!webhook) return;
  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `ApplyLab: ${message}` }),
    signal: AbortSignal.timeout(2000),
  }).catch((error) => console.error("adzuna-ingest: alert webhook failed", error));
}

/** Runs an ingestion against the real Adzuna API and database. */
export function ingestJobs(options: IngestOptions = {}): Promise<IngestResult> {
  const supabase = createServiceRoleClient();
  const adzuna = getAdzunaConfig();
  const client = new AdzunaClient({ ...adzuna, budget: createSupabaseCallBudget(supabase, adzuna.limits) });
  return runIngestion(
    { client, store: createSupabaseIngestStore(supabase), config: getIngestConfig(), alert: alertOps },
    options
  );
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Fails closed when the secret is unset. */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Parses a maxCalls override; undefined when absent, null when invalid. */
export function parseMaxCalls(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_CALLS_OVERRIDE_LIMIT ? parsed : null;
}
