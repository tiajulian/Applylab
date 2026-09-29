// Manually triggers an Adzuna ingestion run via /api/cron/ingest-jobs.
//
//   node scripts/ingest-jobs.mjs --dry-run              # fetch one page, print mapped rows, write nothing
//   node scripts/ingest-jobs.mjs --max-calls 10         # real run capped at 10 Adzuna calls
//   node scripts/ingest-jobs.mjs --url https://applylab.com.au
//
// Needs the app running (npm run dev) at --url (default http://localhost:3000) and CRON_SECRET in
// the environment or .env.local.

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local - rely on the real environment.
}

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const baseUrl = flag("--url") ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET is not set (add it to .env.local).");
  process.exit(1);
}

const url = new URL("/api/cron/ingest-jobs", baseUrl);
if (args.includes("--dry-run")) url.searchParams.set("dryRun", "1");
const maxCalls = flag("--max-calls");
if (maxCalls) url.searchParams.set("maxCalls", maxCalls);

console.log(`GET ${url.pathname}${url.search} ...`);
const response = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } });
const body = await response.json().catch(() => ({}));

if (body.status === "dry_run") {
  console.log(`Dry run: ${body.rows.length} mapped jobs from query ${JSON.stringify(body.query)}`);
  console.table(
    body.rows.map((r) => ({
      title: r.title.slice(0, 40),
      company: r.company?.slice(0, 25),
      location: r.location_display,
      salary: r.salary_min ? `${r.salary_min}-${r.salary_max}${r.salary_is_predicted ? " (est.)" : ""}` : "",
      posted: r.posted_at?.slice(0, 10),
    }))
  );
} else {
  console.log(JSON.stringify(body, null, 2));
}
// exitCode, not process.exit(): exiting straight after fetch trips a libuv assertion on Windows.
process.exitCode = response.ok ? 0 : 1;
