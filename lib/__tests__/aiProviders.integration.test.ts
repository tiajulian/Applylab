import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import type { ResumeContent } from "@/types";

/**
 * Live integration test for the OpenAI/Gemini migration (lib/anthropic/parseJobAd.ts,
 * parseProfile.ts, scoreATS.ts, assistBullet.ts, winStarters.ts, lib/gemini/copilot.ts).
 *
 * This hits real, billed APIs - it exists to answer "is the AI model actually working", which
 * type-checking and mocked unit tests can't answer (a wrong SDK field name, a retired model ID,
 * or a malformed strict-schema request all pass tsc/eslint cleanly and only surface here).
 * Skips itself (not fails) when OPENAI_API_KEY/GEMINI_API_KEY aren't available, so a bare
 * `npm test` stays green and free for anyone without those keys configured - run it deliberately
 * with keys present when you need to confirm the AI providers themselves are healthy (e.g. after
 * a dependency bump, or a model ID retirement like the gemini-2.5-flash 404 hit during the
 * original migration - see lib/gemini/models.ts).
 */

const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) {
  for (const line of readFileSync(envLocalPath, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);
const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

// A UUID that must exist in this Supabase project's `users` table for logApiCost's insert to
// succeed (its user_id column has a foreign-key constraint) - swap if this project's data
// changes. logApiCost is best-effort and never throws even if this doesn't resolve, so a stale
// ID degrades to "cost logging silently no-ops" rather than failing the test.
const TEST_USER_ID = "bd33dc27-a3a8-433b-894e-02a3aeff111f";
const TIMEOUT = 30_000;

const SAMPLE_JOB_AD = `
Senior Software Engineer - Acme Corp

We are hiring a Senior Software Engineer with 5+ years experience in React, TypeScript, and AWS.
Must have strong communication skills and experience mentoring junior engineers.
Nice to have: GraphQL experience, exposure to Kubernetes.
`;

const SAMPLE_RESUME = {
  contact: { name: "Jane Doe", email: "jane@example.com", phone: "0400000000", location: "Sydney, NSW" },
  target_titles: ["Senior Software Engineer"],
  summary: "Senior engineer with 6 years building React/TypeScript web platforms on AWS.",
  skills: ["React", "TypeScript", "AWS", "Mentoring"],
  tools: ["Frontend: React, TypeScript"],
  experience: [
    {
      job_title: "Software Engineer",
      company: "Widgetco",
      location: "Sydney, NSW",
      start_date: "2019",
      end_date: "Present",
      bullets: ["Built and maintained a React/TypeScript web platform serving 50k monthly users."],
    },
  ],
  projects: [],
  education: [],
  referees: [],
} as unknown as ResumeContent;

describe("AI provider integration (OpenAI/Gemini migration)", () => {
  it("loads lib/anthropic/models.ts without OPENAI_API_KEY/GEMINI_API_KEY set", async () => {
    // Regression test: models.ts must only import side-effect-free model-ID constants
    // (lib/openai/models.ts, lib/gemini/models.ts), never the client modules that construct an
    // SDK client (and throw on a missing key) at module load - otherwise one missing key breaks
    // every AI feature in the app, not just the ones that use that provider.
    const savedOpenAi = process.env.OPENAI_API_KEY;
    const savedGemini = process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const { MODEL_BY_FEATURE } = await import("@/lib/anthropic/models");
      // skills-bridge (not generate-resume, which moved to Gemini) is the stable "always Sonnet"
      // feature to assert on here - see MODEL_BY_FEATURE's comment for why it stays put.
      expect(MODEL_BY_FEATURE["skills-bridge"].provider).toBe("anthropic");
    } finally {
      if (savedOpenAi !== undefined) process.env.OPENAI_API_KEY = savedOpenAi;
      if (savedGemini !== undefined) process.env.GEMINI_API_KEY = savedGemini;
    }
  });

  describe.skipIf(!hasOpenAiKey)("OpenAI-backed features", () => {
    it("parseJobAd extracts real structured facts from a job ad", async () => {
      const { parseJobAd } = await import("@/lib/anthropic/parseJobAd");
      const result = await parseJobAd(SAMPLE_JOB_AD, TEST_USER_ID);
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.must_have_skills.length).toBeGreaterThan(0);
    }, TIMEOUT);

    it("scoreATS returns a real numeric score against a resume", async () => {
      const { scoreATS } = await import("@/lib/anthropic/scoreATS");
      const { EMPTY_COMPACT_JOB_AD } = await import("@/lib/anthropic/parseJobAd");
      const result = await scoreATS(
        { ...EMPTY_COMPACT_JOB_AD, must_have_skills: ["React", "TypeScript"] },
        SAMPLE_RESUME,
        TEST_USER_ID
      );
      expect(typeof result.score).toBe("number");
      expect(Array.isArray(result.matched_keywords)).toBe(true);
    }, TIMEOUT);

    it("parseProfileFromText extracts a real profile from resume text", async () => {
      const { parseProfileFromText } = await import("@/lib/anthropic/parseProfile");
      const result = await parseProfileFromText(
        "Jane Doe\nSydney, NSW\n\nExperience\nSoftware Engineer, Widgetco (2019 - Present)\nBuilt a React/TypeScript platform.\n\nSkills: React, TypeScript",
        TEST_USER_ID
      );
      expect(result.fullName.length).toBeGreaterThan(0);
      expect(result.work_experience.length).toBeGreaterThan(0);
    }, TIMEOUT);
  });

  describe.skipIf(!hasGeminiKey)("Gemini-backed features", () => {
    it("assistBullet returns real rewritten bullet options", async () => {
      const { assistBullet } = await import("@/lib/anthropic/assistBullet");
      const { EMPTY_COMPACT_JOB_AD } = await import("@/lib/anthropic/parseJobAd");
      const result = await assistBullet(
        {
          bulletText: "Helped with the React platform migration",
          action: "senior",
          jobTitle: "Senior Software Engineer",
          companyName: "Acme Corp",
          compactJobAd: EMPTY_COMPACT_JOB_AD,
        },
        TEST_USER_ID
      );
      expect(result.length).toBeGreaterThan(0);
    }, TIMEOUT);

    it("extractWinStarters returns real extracted phrases", async () => {
      const { extractWinStarters } = await import("@/lib/anthropic/winStarters");
      const result = await extractWinStarters(
        "Rebuilt the onboarding flow which cut signup drop-off.",
        TEST_USER_ID
      );
      expect(Array.isArray(result)).toBe(true);
    }, TIMEOUT);

    it("generateCopilotAnswer returns a real generated answer", async () => {
      const { generateCopilotAnswer } = await import("@/lib/gemini/copilot");
      const result = await generateCopilotAnswer(
        {
          question: "Tell us about a time you led a technical project.",
          jobTitle: "Senior Software Engineer",
          jobDescriptionSnippet: "React, TypeScript, AWS",
          format: "STAR_METHOD",
          wordLimit: 100,
          skills: "React, TypeScript, AWS",
          experienceSummary: "Led migration of the CI pipeline to GitHub Actions.",
        },
        TEST_USER_ID
      );
      expect(result.length).toBeGreaterThan(0);
    }, TIMEOUT);
  });
});
