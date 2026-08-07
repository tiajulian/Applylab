const AI_VENDOR_PATTERN =
  /\b(anthropic|claude|openai|chatgpt|chat gpt|gpt-?\d|copilot|gemini|bard|perplexity ai)\b/i;

/**
 * Drops any Key Skills / Tools & Platforms entry that names an AI vendor, model, or assistant.
 * The system prompt already tells the model to only list tools grounded in the candidate's own
 * profile, but that's a request, not a guarantee - a model reasoning about a job description that
 * mentions AI tooling can still reach for its own name as a plausible-sounding "tool" to list,
 * which reads as a bizarre, obviously-fabricated line on a real resume (e.g. "Anthropic Claude"
 * next to "SharePoint"). This is a deterministic backstop on top of the prompt instruction, same
 * pattern as the fact-check heuristics in lib/resume/factCheck.ts.
 */
export function stripAiVendorMentions(entries: string[]): string[] {
  return entries.filter((entry) => !AI_VENDOR_PATTERN.test(entry));
}
