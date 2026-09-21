import { describe, it, expect, afterAll } from "vitest";
import { Pool } from "pg";

/**
 * Proves the original #1 bug (read-then-write race: a parallel burst all read "under the limit"
 * and all passed) is dead in the Postgres fallback path, and that a burst does not exhaust a
 * connection pool.
 *
 * Needs a real Postgres with supabase/migrations/20260921010000_atomic_rate_limiter.sql applied
 * (e.g. `npx supabase start` then `npx supabase db reset`). Self-skips - not fails - when none is
 * reachable, so a bare `npm test` stays green. Set TEST_DATABASE_URL to point elsewhere.
 * To test through the real pooler, point it at the Supabase pooler URL (port 6543) of a STAGING
 * project - never production.
 */
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Deliberately small: a burst of 200 concurrent checks must queue through 10 connections, the
// way a pooler in transaction mode would, rather than needing 200.
const POOL_SIZE = 10;

async function connectIfReady(): Promise<{ pool: Pool | null; reason: string }> {
  const pool = new Pool({ connectionString: DATABASE_URL, max: POOL_SIZE, connectionTimeoutMillis: 2000 });
  try {
    const { rows } = await pool.query<{ ok: boolean }>(
      "select to_regprocedure('public.rate_limit_hit(text,integer,integer)') is not null as ok"
    );
    if (!rows[0]?.ok) {
      await pool.end();
      return { pool: null, reason: "rate_limit_hit() not found - apply the atomic_rate_limiter migration first" };
    }
    return { pool, reason: "" };
  } catch (err) {
    await pool.end().catch(() => {});
    return { pool: null, reason: `no reachable Postgres at ${DATABASE_URL} (${(err as Error).message})` };
  }
}

const { pool, reason } = await connectIfReady();
const suite = pool ? describe : describe.skip;
if (!pool) console.warn(`rateLimit integration test skipped: ${reason}`);

async function hit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { rows } = await pool!.query<{ allowed: boolean }>("select * from public.rate_limit_hit($1, $2, $3)", [
    key,
    max,
    windowSeconds,
  ]);
  return rows[0].allowed;
}

suite("rate_limit_hit under parallel load (Postgres fallback path)", () => {
  afterAll(async () => {
    await pool?.query("delete from public.rate_limit_windows where rate_key like 'itest:%'");
    await pool?.end();
  });

  it.each([
    { cap: 5, burst: 200 },
    { cap: 10, burst: 200 },
    { cap: 1, burst: 100 },
  ])("admits exactly $cap of a $burst-request burst", async ({ cap, burst }) => {
    const key = `itest:${cap}:${Date.now()}`;
    const results = await Promise.all(Array.from({ length: burst }, () => hit(key, cap, 3600)));
    expect(results.filter(Boolean)).toHaveLength(cap);
  });

  it("keeps separate keys independent under a mixed burst", async () => {
    const stamp = Date.now();
    const results = await Promise.all(
      Array.from({ length: 300 }, (_, i) => hit(`itest:mix:${stamp}:${i % 3}`, 4, 3600))
    );
    expect(results.filter(Boolean)).toHaveLength(12); // 3 keys x cap 4
  });

  it("completes a large burst through a small pool without exhausting it", async () => {
    const key = `itest:pool:${Date.now()}`;
    const started = Date.now();
    await Promise.all(Array.from({ length: 500 }, () => hit(key, 10, 3600)));
    expect(pool!.totalCount).toBeLessThanOrEqual(POOL_SIZE); // never opened more than the pool allows
    expect(pool!.waitingCount).toBe(0); // and everything drained
    console.info(`500 checks through a ${POOL_SIZE}-connection pool in ${Date.now() - started}ms`);
  });

  it("holds concurrency leases to the cap under a burst", async () => {
    const key = `itest:lease:${Date.now()}`;
    const ids = await Promise.all(
      Array.from({ length: 100 }, async () => {
        const { rows } = await pool!.query<{ id: string | null }>(
          "select public.concurrency_acquire($1, 3, 60) as id",
          [key]
        );
        return rows[0].id;
      })
    );
    expect(ids.filter(Boolean)).toHaveLength(3);
    await pool!.query("delete from public.concurrency_leases where lease_key = $1", [key]);
  });
});
