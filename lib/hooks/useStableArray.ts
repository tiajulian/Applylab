"use client";

import { useState } from "react";

const sameItems = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item, i) => item === b[i]);

/**
 * `values`, but the same array instance for as long as its items don't change - for arrays rebuilt
 * on every render (split from text being typed) that feed a memo or callback's dependencies.
 */
export function useStableArray(values: readonly string[]): readonly string[] {
  const [stable, setStable] = useState(values);
  if (sameItems(stable, values)) return stable;
  // Adjusting state during render: React re-renders straight away with the new array.
  setStable(values);
  return values;
}
