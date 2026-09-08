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
  // The shrink-only exception list that used to live here (assistBullet.ts, scoreContent.ts,
  // scoreResumeCombined.ts, retailorResume.ts, generateResume.ts, followupDraft.ts,
  // generateCoverLetter.ts, parseProfile.ts, roleDuties.ts, winStarters.ts, skillsBridge.ts,
  // parseJobAd.ts, lib/profile/extractSkills.ts, lib/resume/scoreReview.ts, lib/gemini/copilot.ts,
  // generateInterviewQuestions.ts, generateInterviewReport.ts, scoreInterviewAnswer.ts,
  // app/api/projects/enhance/route.ts, and finally the interview audio TTS route) is gone - every
  // one of the original pre-gateway call sites has now been ported onto callGateway(). If a new
  // exception is ever needed for freshly written code, that's a red flag per the free-tier-ai-
  // limiting test plan's §1 ("the rule allows-lists files individually and the list keeps
  // growing"), not a routine change - route the new code through the gateway instead.
  overrides: [
    {
      files: ["lib/aiGateway/**"],
      rules: { "no-restricted-imports": "off" },
    },
  ],
};
