"use client";

import { forwardRef, useCallback } from "react";
import { SuggestInput, type SuggestInputProps } from "@/components/ui/SuggestInput";
import { suggestionsFromList } from "@/lib/text/fuzzyMatch";

export interface CatalogInputProps extends Omit<SuggestInputProps, "suggest"> {
  /** The values to suggest from, most common first. Pass a module-level constant. */
  catalog: readonly string[];
}

/** A free-text Input that suggests from a fixed list as you type (companies, degrees, job titles...). */
export const CatalogInput = forwardRef<HTMLInputElement, CatalogInputProps>(({ catalog, ...props }, ref) => {
  const suggest = useCallback((query: string) => suggestionsFromList(query, catalog), [catalog]);
  return <SuggestInput ref={ref} {...props} suggest={suggest} />;
});

CatalogInput.displayName = "CatalogInput";
