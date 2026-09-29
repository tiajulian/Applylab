"use client";

import { SuggestInput, type SuggestInputProps } from "@/components/ui/SuggestInput";
import { PLACES_CREDIT, usePlaceSearch } from "@/lib/places/usePlaceSearch";

/**
 * A free-text location field that suggests Australian suburbs as you type ("kog" -> "Kogarah, NSW",
 * typos and postcodes too). Picking one fills "Suburb, STATE"; anything else can still be typed.
 */
export function LocationInput({ onFocus, ...props }: Omit<SuggestInputProps, "suggest" | "footer">) {
  const { suggest, load } = usePlaceSearch();
  return (
    <SuggestInput
      {...props}
      suggest={suggest}
      footer={PLACES_CREDIT}
      onFocus={(e) => {
        load();
        onFocus?.(e);
      }}
    />
  );
}
