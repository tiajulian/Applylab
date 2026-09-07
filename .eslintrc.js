// .js instead of .json so the exception list below can carry a real comment explaining itself -
// JSON has no comment syntax, and this list's whole safety property depends on whoever reviews an
// addition to it actually reading why it's supposed to be shrink-only.
module.exports = {
  extends: "next/core-web-vitals",
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@/lib/anthropic/client",
            importNames: ["anthropic"],
            message:
              'The Anthropic SDK client is only allowed inside lib/aiGateway/ - import `anthropic` from "@/lib/aiGateway/gateway" instead. See the free-tier-ai-limiting-spec §5 ("Features never import the provider SDK clients directly").',
          },
          {
            name: "@/lib/openai/client",
            message:
              'The OpenAI SDK client is only allowed inside lib/aiGateway/ - import `openai` from "@/lib/aiGateway/gateway" instead. See the free-tier-ai-limiting-spec §5.',
          },
          {
            name: "@/lib/gemini/client",
            message:
              'The Gemini SDK client is only allowed inside lib/aiGateway/ - import `gemini`/`geminiOutputTokens` from "@/lib/aiGateway/gateway" instead. See the free-tier-ai-limiting-spec §5.',
          },
          {
            name: "@/lib/googleTts/synthesizeSpeech",
            message:
              "Google TTS is only allowed to be called from inside lib/aiGateway/ - route it through the gateway instead. See the free-tier-ai-limiting-spec §5/§8.",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ["lib/aiGateway/**"],
      rules: { "no-restricted-imports": "off" },
    },
    {
      // TEMPORARY, SHRINK-ONLY exception list for call sites that predate the AI gateway (spec
      // §12 migration order) and haven't been ported yet. Every entry here is a route/feature
      // still gated by its own old mechanism (a feature counter, or nothing) - same as
      // generate-resume was before it was ported (see lib/anthropic/generateResume.ts, the first
      // one moved onto callGateway()). Delete a file's entry in the same PR that ports it - never
      // add a new entry for freshly written code. A growing list here is the exact anti-pattern
      // the free-tier-ai-limiting test plan's §1 red flag warns about ("the rule allows-lists
      // files individually and the list keeps growing") - treat any addition as a review red
      // flag, not a routine change.
      files: [
        // lib/anthropic/assistBullet.ts, scoreContent.ts, scoreResumeCombined.ts,
        // retailorResume.ts, generateResume.ts, followupDraft.ts, generateCoverLetter.ts,
        // parseProfile.ts, roleDuties.ts, winStarters.ts, skillsBridge.ts,
        // lib/profile/extractSkills.ts, lib/resume/scoreReview.ts, lib/gemini/copilot.ts,
        // lib/gemini/generateInterviewQuestions.ts, generateInterviewReport.ts,
        // scoreInterviewAnswer.ts, and app/api/projects/enhance/route.ts removed here as each was
        // ported onto callGateway() - this list only ever shrinks (see the comment above). Two
        // entries left deliberately: TTS needs its own cost-logging design (spec §8) before it
        // can be metered the same way as the others, and parseJobAd is bundled with the separate
        // 7-login-only-routes/cache-miss-fan-out work (see resume-assist route's own comment).
        "app/api/interview/turns/*/audio/route.ts",
        "lib/anthropic/parseJobAd.ts",
      ],
      rules: { "no-restricted-imports": "off" },
    },
  ],
};
