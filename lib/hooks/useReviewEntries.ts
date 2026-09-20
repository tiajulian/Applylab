"use client";

import { useCallback, useMemo, useState } from "react";
import { buildEntries, type DecisionLog, type EntryState, type ReviewEntry, type UndoEdit } from "@/lib/review/progress";
import type { ReviewItem } from "@/lib/review/types";

/**
 * The review list as the panel and the chip both see it: live items plus what this session decided.
 * `record` remembers a decision (and how to undo any text change it made); `forget` drops it on undo.
 */
export function useReviewEntries(items: ReviewItem[], order: ReadonlyMap<string, number>) {
  const [log, setLog] = useState<DecisionLog>(() => new Map());

  const entries = useMemo(() => buildEntries(items, log, order), [items, log, order]);

  const record = useCallback((item: ReviewItem, state: Exclude<EntryState, "pending">, undo?: UndoEdit) => {
    setLog((prev) => new Map(prev).set(item.id, { item, state, undo } satisfies ReviewEntry));
  }, []);

  const forget = useCallback((id: string) => {
    setLog((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return { entries, record, forget };
}
