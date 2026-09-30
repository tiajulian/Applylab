"use client";

import { forwardRef, useMemo, useState, type ReactNode } from "react";
import { Input, type InputProps } from "@/components/ui/Input";
import { useSuggestions, type Suggestion } from "@/components/ui/useSuggestions";

export interface SuggestInputProps extends Omit<InputProps, "value" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Suggestions for the current text. Keep it stable (module-level or useCallback). */
  suggest: (query: string) => Suggestion[];
  /** Small print under the suggestions, e.g. a data credit. */
  footer?: ReactNode;
}

/**
 * A free-text Input that suggests values as you type - picking one fills the field, and anything
 * else can still be typed. The list only opens on typing, so focusing an already-filled field
 * doesn't pop suggestions over the form.
 */
export const SuggestInput = forwardRef<HTMLInputElement, SuggestInputProps>(
  ({ value, onValueChange, suggest, footer, onBlur, onKeyDown, ...props }, ref) => {
    // Only search once the person types here: pre-filled or autofilled fields (the profile page has
    // many) shouldn't each scan their list on every render for a dropdown that isn't open.
    const [typing, setTyping] = useState(false);
    const items = useMemo(
      () => (typing ? suggest(value).filter((item) => item.value !== value) : []),
      [typing, suggest, value]
    );
    const dropdown = useSuggestions(items, onValueChange, { footer });

    return (
      <div className="relative">
        <Input
          ref={ref}
          {...props}
          {...dropdown.inputProps}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value);
            setTyping(true);
            dropdown.onType();
          }}
          onBlur={(e) => {
            setTyping(false);
            dropdown.close();
            onBlur?.(e);
          }}
          onKeyDown={(e) => {
            // ArrowDown on a filled field shows its suggestions without having to edit it first.
            if (e.key === "ArrowDown" && !typing) {
              setTyping(true);
              dropdown.open();
            }
            if (!dropdown.handleKeyDown(e)) onKeyDown?.(e);
          }}
        />
        {dropdown.list}
      </div>
    );
  }
);

SuggestInput.displayName = "SuggestInput";
