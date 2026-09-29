"use client";

import { useMemo } from "react";
import { Input, type InputProps } from "@/components/ui/Input";
import { useSuggestions } from "@/components/ui/useSuggestions";
import { PLACES_CREDIT, usePlaceSearch } from "@/lib/places/usePlaceSearch";

/**
 * A free-text location field that suggests Australian suburbs as you type ("kog" -> "Kogarah, NSW",
 * typos and postcodes too). Picking one fills "Suburb, STATE"; anything else can still be typed.
 */
export function LocationInput({
  value,
  onValueChange,
  ...props
}: Omit<InputProps, "value" | "onChange"> & { value: string; onValueChange: (value: string) => void }) {
  const { suggest, load } = usePlaceSearch();
  const items = useMemo(() => suggest(value).filter((item) => item.value !== value), [suggest, value]);
  const dropdown = useSuggestions(items, onValueChange, PLACES_CREDIT);

  return (
    <div className="relative">
      <Input
        {...props}
        {...dropdown.inputProps}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          dropdown.onType();
        }}
        onFocus={() => {
          load();
          dropdown.open();
        }}
        onBlur={dropdown.close}
        onKeyDown={dropdown.handleKeyDown}
      />
      {dropdown.list}
    </div>
  );
}
