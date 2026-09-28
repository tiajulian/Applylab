import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

/**
 * Exercises the SQL half of ingestion: upsert idempotency, re-embed on content change, dedupe,
 * expiry, the call budget and the single-run lock.
 *
 * Needs a real Postgres with supabase/migrations/20260928000000_job_matching.sql applied (e.g.
 * `npx supabase start` then `npx supabase db reset`). Self-skips - not fails - when none is
 * reachable, so a bare `npm test` stays green. Set TEST_DATABASE_URL to point elsewhere - never
 * production: this test deletes every adzuna_* row.
 */
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function connectIfReady(): Promise<{ pool: Pool | null; reason: string }> {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 4, connectionTimeoutMillis: 2000 });
  try {
    const { rows } = await pool.query<{ ok: boolean }>(
      "select to_regprocedure('public.adzuna_upsert_jobs(jsonb)') is not null as ok"
    );
    if (!rows[0]?.ok) {
      await pool.end();
      return { pool: null, reason: "adzuna_upsert_jobs() not found - apply the job_matching migration first" };
    }
    return { pool, reason: "" };
  } catch (err) {
    await pool.end().catch(() => {});
    return { pool: null, reason: `no reachable Postgres at ${DATABASE_URL} (${(err as Error).message})` };
  }
}

const { pool, reason } = await connectIfReady();
const suite = pool ? describe : describe.skip;
if (!pool) console.warn(`adzuna ingestion integration test skipped: ${reason}`);

const EMBEDDING = `[${Array(1536).fill(0.01).join(",")}]`;

function row(id: string, overrides: Record<string, unknown> = {}) {
  return {
    source: "adzuna",
    external_id: id,
    title: `Job ${id}`,
    company: "Acme",
    description_snippet: "Snippet",
    location_display: "Sydney",
    location_area: ["Australia", "NSW", "Sydney"],
    redirect_url: `https://www.adzuna.com.au/land/ad/${id}`,
    posted_at: new Date().toISOString(),
    content_hash: "hash-a",
    ...overrides,
  };
}

async function upsert(rows: unknown[]) {
  const { rows: result } = await pool!.query("select * from public.adzuna_upsert_jobs($1::jsonb)", [JSON.stringify(rows)]);
  return result[0] as { inserted: number; updated: number };
}

async function job(id: string) {
  const { rows } = await pool!.query(
    "select is_active, embedding is not null as embedded, first_seen_at, last_seen_at from public.adzuna_jobs where external_id = $1",
    [id]
  );
  return rows[0];
}

suite("adzuna ingestion SQL", () => {
  beforeEach(async () => {
    await pool!.query("delete from public.adzuna_jobs");
    await pool!.query("delete from public.adzuna_api_usage where provider like 'itest%'");
    await pool!.query("delete from public.adzuna_ingest_runs");
  });

  afterAll(async () => {
    await pool?.query("delete from public.adzuna_jobs");
    await pool?.query("delete from public.adzuna_api_usage where provider like 'itest%'");
    await pool?.query("delete from public.adzuna_ingest_runs");
    await pool?.end();
  });

  it("upsert is idempotent and keeps first_seen_at", async () => {
    expect(await upsert([row("1"), row("2")])).toEqual({ inserted: 2, updated: 0 });
    const before = await job("1");
    expect(await upsert([row("1"), row("2")])).toEqual({ inserted: 0, updated: 2 });
    const after = await job("1");

    const { rows } = await pool!.query("select count(*)::int as n from public.adzuna_jobs");
    expect(rows[0].n).toBe(2);
    expect(after.first_seen_at).toEqual(before.first_seen_at);
    expect(after.last_seen_at.getTime()).toBeGreaterThanOrEqual(before.last_seen_at.getTime());
  });

  it("clears the embedding only when content changes", async () => {
    await upsert([row("1"), row("2")]);
    await pool!.query("update public.adzuna_jobs set embedding = $1::extensions.vector", [EMBEDDING]);

    await upsert([row("1"), row("2", { content_hash: "hash-b" })]);
    expect((await job("1")).embedded).toBe(true);
    expect((await job("2")).embedded).toBe(false);
  });

  it("dedupes same title + company + location, keeping the newest", async () => {
    const day = 86_400_000;
    await upsert([
      row("old", { title: "Nurse", posted_at: new Date(Date.now() - 3 * day).toISOString() }),
      row("new", { title: "NURSE", posted_at: new Date().toISOString() }),
      row("other", { title: "Nurse", company: "Other Co" }),
    ]);

    expect((await pool!.query("select public.adzuna_dedupe_jobs() as n")).rows[0].n).toBe(1);
    expect((await job("old")).is_active).toBe(false);
    expect((await job("new")).is_active).toBe(true);
    expect((await job("other")).is_active).toBe(true);
  });

  it("expires jobs not seen for N days or posted too long ago", async () => {
    await upsert([row("fresh"), row("unseen"), row("ancient", { posted_at: "2020-01-01T00:00:00Z" })]);
    await pool!.query("update public.adzuna_jobs set last_seen_at = now() - interval '15 days' where external_id = 'unseen'");

    expect((await pool!.query("select public.adzuna_expire_jobs(14, 45) as n")).rows[0].n).toBe(2);
    expect((await job("fresh")).is_active).toBe(true);
    expect((await job("unseen")).is_active).toBe(false);
    expect((await job("ancient")).is_active).toBe(false);
  });

  it("counts calls and blocks at the first full window without counting the blocked call", async () => {
    const consume = async () =>
      (await pool!.query("select * from public.adzuna_consume_call('itest', 100, 3, 1000, 2500)")).rows[0];

    for (let i = 1; i <= 3; i++) expect(await consume()).toMatchObject({ allowed: true, day_count: i });
    expect(await consume()).toMatchObject({ allowed: false, blocked_window: "day", day_count: 3, minute_count: 3 });
  });

  it("allows only one running ingestion", async () => {
    await pool!.query("insert into public.adzuna_ingest_runs (status) values ('running')");
    await expect(pool!.query("insert into public.adzuna_ingest_runs (status) values ('running')")).rejects.toMatchObject({
      code: "23505",
    });
    await pool!.query("update public.adzuna_ingest_runs set status = 'succeeded'");
    await expect(pool!.query("insert into public.adzuna_ingest_runs (status) values ('running')")).resolves.toBeTruthy();
  });
});
