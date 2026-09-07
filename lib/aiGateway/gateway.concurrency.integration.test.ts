import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Real-Postgres concurrency test for reserve_ai_credits (supabase/migrations/
 * 20260907000000_ai_gateway_ledger.sql). Every other test in this package (gateway.test.ts)
 * mocks the Supabase client, which proves callGateway's own control flow but can never prove
 * atomicity - the race being defended against lives entirely inside the RPC's
 * pg_advisory_xact_lock + read-then-insert, and a mock can't reproduce a real transaction
 * interleaving. See the free-tier-ai-limiting test plan §3, whose explicit red flag is a
 * "concurrency test" that never actually touches a real database.
 *
 * Requires a local Postgres with this migration applied. Get one with:
 *   1. npx supabase start          (spins up local Postgres via Docker - see supabase/config.toml)
 *   2. psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" \
 *        -f supabase/schema.sql \
 *        -f supabase/migrations/20260907000000_ai_gateway_ledger.sql
 *      (schema.sql is the baseline this repo's migrations/ directory builds on top of - see its
 *      own header comment - so `supabase db reset` alone will NOT create public.users etc.)
 *   3. Optionally set TEST_DATABASE_URL if it differs from the local-CLI default below.
 *
 * Self-skips (not fails) when no such database is reachable, so a bare `npm test` stays green on
 * a machine without Docker - same intent as lib/__tests__/aiProviders.integration.test.ts for
 * missing API keys, just gated on a real (top-level-awaited) connection attempt instead of an env
 * var, since "is Postgres up" can't be answered synchronously. Run it deliberately, with the
 * database above prepared, to actually exercise the race.
 */

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Vitest collects `describe` bodies synchronously before any hook runs, so the reachability check
// has to happen here, at module load, via top-level await - not inside beforeAll (which runs too
// late to decide whether to register the real tests or a describe.skip stub).
async function connectIfReady(): Promise<{ client: Client | null; reason: string }> {
  const candidate = new Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
  try {
    await candidate.connect();
    const { rows } = await candidate.query<{ exists: boolean }>(
      "select to_regprocedure('public.reserve_ai_credits(uuid,text,text,text,text,int,timestamptz,int)') is not null as exists"
    );
    if (!rows[0]?.exists) {
      await candidate.end();
      return {
        client: null,
        reason: "reserve_ai_credits() not found - apply schema.sql + the ai_gateway_ledger migration first (see file header)",
      };
    }
    return { client: candidate, reason: "" };
  } catch (err) {
    await candidate.end().catch(() => {});
    return { client: null, reason: `no reachable Postgres at ${DATABASE_URL} (${(err as Error).message}) - run \`npx supabase start\` first` };
  }
}

const { client, reason } = await connectIfReady();

/**
 * reserve_ai_credits is security-definer and checks `p_user_id = auth.uid()`. This raw `pg`
 * connection is the Postgres superuser, not an `authenticated` PostgREST request with a JWT, so
 * auth.uid() would normally read NULL and fail that check. Point auth.uid() at our test user for
 * the session the same way PostgREST does per-request - via the request.jwt.claims GUC
 * Supabase's own auth.uid() definition reads from.
 */
async function actAsUser(db: Client, userId: string) {
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: userId })]);
}

/**
 * public.users.id is a foreign key to auth.users(id) (see schema.sql) - a bare insert into
 * public.users alone violates that constraint, so a real auth.users row has to exist first. This
 * is the minimal-columns insert pattern commonly used to seed Supabase's local auth schema for
 * testing (several text columns are NOT NULL with no default on some GoTrue versions, hence the
 * explicit empty strings) - the exact column set can drift with the bundled GoTrue version, so if
 * this insert starts failing after a `supabase` CLI upgrade, that's the first place to look.
 * Deleting the auth.users row cascades through public.users to ai_usage_ledger (both declared
 * `on delete cascade`), so cleanup only ever needs to touch auth.users.
 */
async function createTestUser(db: Client): Promise<string> {
  const userId = randomUUID();
  const email = `${userId}@test.local`;
  await db.query(
    `insert into auth.users (
       instance_id, id, aud, role, email, encrypted_password,
       email_confirmed_at, recovery_sent_at, last_sign_in_at,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
       confirmation_token, email_change, email_change_token_new, recovery_token
     ) values (
       '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2,
       crypt('test-password', gen_salt('bf')), now(), now(), now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now(),
       '', '', '', ''
     )`,
    [userId, email]
  );
  await db.query("insert into public.users (id, email) values ($1, $2)", [userId, email]);
  return userId;
}

async function deleteTestUser(db: Client, userId: string): Promise<void> {
  await db.query("delete from auth.users where id = $1", [userId]);
}

describe.skipIf(!client)("reserve_ai_credits - real concurrency (test plan §3)", () => {
  afterAll(async () => {
    await client?.end();
  });

  it("grants exactly one reservation when two concurrent requests race for the last unit", async () => {
    const userId = await createTestUser(client!);
    await actAsUser(client!, userId);

    const reserve = () =>
      client!.query<{ reserve_ai_credits: string | null }>(
        `select reserve_ai_credits($1, 'free', 'generate-resume', 'gemini', 'gemini-3.6-flash', 1, null, 1)`,
        [userId]
      );

    // Genuinely parallel - both requests hit Postgres before either's transaction commits. If
    // pg_advisory_xact_lock were removed from the RPC, both could read balance=0 before either's
    // insert lands and both would be granted, which is exactly the race this test exists to catch.
    const [a, b] = await Promise.all([reserve(), reserve()]);
    const granted = [a.rows[0].reserve_ai_credits, b.rows[0].reserve_ai_credits].filter(Boolean);

    expect(granted).toHaveLength(1);

    await deleteTestUser(client!, userId);
  });

  it("under load, grants exactly as many reservations as the quota allows and never oversells", async () => {
    const userId = await createTestUser(client!);
    await actAsUser(client!, userId);

    const QUOTA = 3;
    const CONCURRENT_REQUESTS = 10;
    const reserve = () =>
      client!.query<{ reserve_ai_credits: string | null }>(
        `select reserve_ai_credits($1, 'free', 'generate-resume', 'gemini', 'gemini-3.6-flash', 1, null, $2)`,
        [userId, QUOTA]
      );

    const results = await Promise.all(Array.from({ length: CONCURRENT_REQUESTS }, reserve));
    const granted = results.filter((r) => r.rows[0].reserve_ai_credits !== null);

    expect(granted).toHaveLength(QUOTA);

    // Balance sum must never exceed the quota - the money-safety property, checked independently
    // of the grant count above (a bug could grant the right *count* while still double-counting).
    const { rows: balanceRows } = await client!.query<{ total: string }>(
      `select coalesce(sum(credits_reserved), 0) as total from public.ai_usage_ledger
       where user_id = $1 and status = 'reserved'`,
      [userId]
    );
    expect(Number(balanceRows[0].total)).toBeLessThanOrEqual(QUOTA);

    await deleteTestUser(client!, userId);
  });
});

describe.skipIf(Boolean(client))(`reserve_ai_credits - real concurrency (skipped: ${reason})`, () => {
  it("skipped - see file header for setup", () => {});
});
