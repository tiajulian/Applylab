import { WIN_VERBS } from "@/lib/wins/constants";

const COMMON_ACTION_VERBS = [
  ...WIN_VERBS,
  "engineered",
  "developed",
  "optimised",
  "optimized",
  "automated",
  "spearheaded",
  "refactored",
  "designed",
  "implemented",
  "delivered",
  "executed",
  "architected",
  "processed",
  "reconciled",
];

const COMMON_TECH_KEYWORDS = [
  "SQL",
  "Python",
  "Snowflake",
  "React",
  "AWS",
  "Tableau",
  "Java",
  "TypeScript",
  "JavaScript",
  "Excel",
  "Power BI",
  "Docker",
  "Kubernetes",
  "Node.js",
  "PostgreSQL",
  "GCP",
  "Azure",
];

export interface SmartPrefillResult {
  verb: string;
  what: string;
  tools: string[];
  outcome: string;
}

export function smartPrefill(rawText: string, profileTools: string[] = []): SmartPrefillResult {
  const text = rawText.trim();
  if (!text) {
    return { verb: "", what: "", tools: [], outcome: "" };
  }

  const words = text.split(/\s+/);
  const firstWord = words[0]?.toLowerCase().replace(/[^a-z]/g, "");

  let matchedVerb = "";
  if (firstWord) {
    const found = COMMON_ACTION_VERBS.find((v) => v.toLowerCase() === firstWord);
    if (found) {
      const isStandard = WIN_VERBS.includes(found as typeof WIN_VERBS[number]);
      matchedVerb = isStandard ? found : found.charAt(0).toUpperCase() + found.slice(1);
    }
  }

  const allToolCandidates = Array.from(new Set([...profileTools, ...COMMON_TECH_KEYWORDS]));
  const matchedTools: string[] = [];
  for (const candidate of allToolCandidates) {
    if (!candidate) continue;
    const regex = new RegExp(`\\b${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(text)) {
      matchedTools.push(candidate);
    }
  }

  let matchedOutcome = "";
  if (/reduc|cut|decreas|lower/i.test(text)) {
    matchedOutcome = "saved time & cut errors";
  } else if (/improv|streamlin|optimis|optimiz|enhanc/i.test(text)) {
    matchedOutcome = "improved efficiency";
  } else if (/built|created|develop|implement|architect/i.test(text)) {
    matchedOutcome = "delivered solution";
  }

  let what = text;
  if (matchedVerb && words.length > 1) {
    what = words.slice(1).join(" ");
  }

  return {
    verb: matchedVerb,
    what,
    tools: matchedTools,
    outcome: matchedOutcome,
  };
}
