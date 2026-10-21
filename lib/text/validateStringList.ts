import { sanitizeDeep } from "@/lib/text/sanitizeDashes";

const MAX_LIST_ITEM_LENGTH = 100;
const MAX_LIST_LENGTH = 20;

export type ListValidation = { ok: true; value: string[] } | { ok: false; error: string };

/**
 * For saving a user's own list (tools, stakeholders): rejects, rather than silently drops, anything
 * that doesn't fit - wrong type or over length both fail, never a quiet truncation. A
 * trimmed-to-empty entry is the one exception: it carries no user-entered content to lose (the
 * ChipPicker client never lets an empty chip be added), so it's dropped rather than rejected.
 * Contrast cleanStringList, the lenient version for lists about to be spliced into an AI prompt.
 */
export function validateStringList(value: unknown, fieldName: string): ListValidation {
  if (!Array.isArray(value)) {
    return { ok: false, error: `${fieldName} must be an array of strings` };
  }
  if (value.length > MAX_LIST_LENGTH) {
    return { ok: false, error: `${fieldName} must have ${MAX_LIST_LENGTH} items or fewer` };
  }

  const cleaned: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      return { ok: false, error: `${fieldName} must contain only strings` };
    }
    const trimmed = sanitizeDeep(item.trim());
    if (!trimmed) continue;
    if (trimmed.length > MAX_LIST_ITEM_LENGTH) {
      return { ok: false, error: `${fieldName} items must be ${MAX_LIST_ITEM_LENGTH} characters or fewer` };
    }
    cleaned.push(trimmed);
  }
  return { ok: true, value: cleaned };
}
