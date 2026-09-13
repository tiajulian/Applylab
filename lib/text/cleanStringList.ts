import { sanitizeDeep } from "@/lib/text/sanitizeDashes";

const DEFAULT_MAX_ITEMS = 20;
const DEFAULT_MAX_ITEM_LENGTH = 100;

/**
 * Lenient string-list normalizer: trims, sanitizes, drops empties, and silently clamps both item
 * count and per-item length. For callers that want a lightly-bounded best-effort array (e.g. tool
 * names about to be spliced into an AI prompt) rather than a hard validation error - contrast with
 * the reject-on-violation `validateStringList` in app/api/role-duties/[suggestionId]/items/
 * [itemId]/route.ts, which 400s instead of truncating because that endpoint persists the value.
 */
export function cleanStringList(
  value: unknown,
  { maxItems = DEFAULT_MAX_ITEMS, maxItemLength = DEFAULT_MAX_ITEM_LENGTH }: { maxItems?: number; maxItemLength?: number } = {}
): string[] {
  if (!Array.isArray(value)) return [];
  const cleaned: string[] = [];
  for (const item of value) {
    if (cleaned.length >= maxItems) break;
    if (typeof item !== "string") continue;
    const trimmed = sanitizeDeep(item.trim()).slice(0, maxItemLength);
    if (trimmed) cleaned.push(trimmed);
  }
  return cleaned;
}
