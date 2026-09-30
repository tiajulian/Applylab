"use client";

import { useCallback, useState } from "react";
import { loadSuburbs, suggestPlaces, type Suburb } from "@/lib/places/suburbs";

/**
 * Suburb search for a location field. The list (~120 KB compressed) is only fetched once `load` is called -
 * wire it to the field's focus so pages that never touch a location field don't download it.
 * Until it arrives (or if it fails) only `extras` are suggested; typing still works either way.
 */
export function usePlaceSearch({
  extras,
  extraStates,
}: {
  extras?: readonly string[];
  extraStates?: Readonly<Record<string, string>>;
} = {}) {
  const [suburbs, setSuburbs] = useState<Suburb[]>([]);

  const load = useCallback(() => {
    if (suburbs.length) return;
    loadSuburbs().then(setSuburbs).catch(() => {});
  }, [suburbs.length]);

  /** `exclude`: places already chosen, left out before picking the best `limit`. */
  const suggest = useCallback(
    (query: string, exclude: readonly string[] = [], limit?: number) =>
      suggestPlaces(query, suburbs, { extras, extraStates, exclude, limit }),
    [suburbs, extras, extraStates]
  );

  return { suggest, load };
}

/** GeoNames data is CC BY 4.0 - shown under place suggestions. */
export const PLACES_CREDIT = "Places from GeoNames";
