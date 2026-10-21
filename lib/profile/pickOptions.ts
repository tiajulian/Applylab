export const sameText = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// Lines asked about in one "Add tools or teams?" step - the same cap as the rewrite itself
// (MAX_DUTY_TEXTS in app/api/role-duties/generate-achievements/route.ts).
export const MAX_PICK_LINES = 8;

// Same 20-item cap as validateStringList in app/api/role-duties/[suggestionId]/items/[itemId]/route.ts.
export const MAX_PICKS_PER_LINE = 20;

/**
 * Chips for one line or task: the AI's likely picks (using the candidate's own spelling when it's
 * already on their profile, and listing those first), plus anything already picked. Case-insensitive
 * dedupe; an already-picked value keeps its own spelling so its chip shows as selected.
 */
export function pickOptions(suggested: string[], profileList: string[], picked: string[]): string[] {
  const fromProfile: string[] = [];
  const fresh: string[] = [];
  for (const value of suggested) {
    const saved = profileList.find((p) => sameText(p, value));
    (saved ? fromProfile : fresh).push(saved ?? value);
  }
  const options: string[] = [];
  for (const value of [...fromProfile, ...fresh, ...picked]) {
    const spelling = picked.find((p) => sameText(p, value)) ?? value;
    if (!options.some((o) => sameText(o, spelling))) options.push(spelling);
  }
  return options;
}

/** Toggle `value` in `list` (case-insensitively), never growing past MAX_PICKS_PER_LINE. */
export function togglePick(list: string[], value: string): string[] {
  if (list.some((v) => sameText(v, value))) return list.filter((v) => !sameText(v, value));
  return addPick(list, value);
}

/** Add `value` unless it's already there (case-insensitively) or the list is full. */
export function addPick(list: string[], value: string): string[] {
  return list.some((v) => sameText(v, value)) || list.length >= MAX_PICKS_PER_LINE ? list : [...list, value];
}

/** Calls `addToProfile` once for each picked value not yet on the profile list (case-insensitive). */
export function saveNewPicksToProfile(picks: string[][], profileList: string[], addToProfile: (value: string) => void) {
  const known = [...profileList];
  for (const value of picks.flat()) {
    if (!known.some((k) => sameText(k, value))) {
      known.push(value);
      addToProfile(value);
    }
  }
}
