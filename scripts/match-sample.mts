// Prints the top 10 job matches for a sample profile, straight from the live database. Read-only:
// nothing is cached or saved. One OpenAI embedding call (~$0.000002).
//
//   npx tsx scripts/match-sample.mts
//   npx tsx scripts/match-sample.mts --titles "Registered Nurse" --skills "aged care,medication" --locations Brisbane
//   npx tsx scripts/match-sample.mts --locations Kogarah --radius 25   (--radius any = all of Australia)

process.loadEnvFile(".env.local");

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const list = (value: string) => value.split(",").map((v) => v.trim()).filter(Boolean);

// Imported after the env file loads: the OpenAI client reads its key at import time.
const { embedSystemTexts } = await import("@/lib/aiGateway/embeddings");
const { createServiceRoleClient } = await import("@/lib/supabase/server");
const { findMatches } = await import("@/lib/jobs/matching/match");
const { createSupabaseMatchStore } = await import("@/lib/jobs/matching/store");
const { buildProfileText } = await import("@/lib/jobs/matching/text");
const { getMatchWeights } = await import("@/lib/jobs/config");
const { toPercent } = await import("@/lib/jobs/matching/score");

const minSalary = Number(flag("--min-salary", "90000")) || null;
const profile = {
  targetTitles: list(flag("--titles", "Frontend Developer,Software Engineer")),
  skills: list(flag("--skills", "React,TypeScript,JavaScript,Node.js")),
  locations: list(flag("--locations", "Sydney")),
  seniority: "Mid",
  resumeText: null,
};

const radius = flag("--radius", "50");
const radiusKm = radius === "any" ? null : Number(radius);
const supabase = createServiceRoleClient();
const [vector] = await embedSystemTexts([buildProfileText(profile)]);
const started = Date.now();
const matches = await findMatches(
  {
    userId: null,
    ...profile,
    radiusKm,
    remoteOk: true,
    minSalary,
    contractTypes: [],
    embedding: `[${vector.join(",")}]`,
  },
  createSupabaseMatchStore(supabase),
  getMatchWeights()
);

console.log(`Profile: ${profile.targetTitles.join(" / ")} | ${profile.skills.join(", ")} | ${profile.locations.join(", ")} (${radiusKm ? `${radiusKm} km` : "anywhere"}) | min $${minSalary ?? 0}`);
console.log(`${matches.length} matches in ${Date.now() - started} ms. Top 10:\n`);
matches.slice(0, 10).forEach((m, i) => {
  console.log(`${String(i + 1).padStart(2)}. ${toPercent(m.score)}%  ${m.job.title} - ${m.job.company ?? "?"} (${m.job.location_display})`);
  console.log(`      ${m.reasons.join(" · ")}`);
});
