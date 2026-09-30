"use client";

import { forwardRef, useCallback, type ReactNode } from "react";
import { Input, type InputProps } from "@/components/ui/Input";
import { useSuggestions, type Suggestion } from "@/components/ui/useSuggestions";

export interface SuggestInputProps extends Omit<InputProps, "value" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Suggestions for the current text. Keep it stable (module-level or useCallback). */
  suggest: (query: string) => readonly Suggestion[];
  /** Small print under the suggestions, e.g. a data credit. */
  footer?: ReactNode;
}

/**
 * A free-text Input that suggests values as you type - picking one fills the field, and anything
 * else can still be typed. The list opens on typing (or ArrowDown), not on focus, so tabbing
 * through an already-filled form doesn't pop suggestions over it.
 */
export const SuggestInput = forwardRef<HTMLInputElement, SuggestInputProps>(
  ({ value, onValueChange, suggest, footer, onBlur, onKeyDown, ...props }, ref) => {
    // Picking fills the field, so don't suggest exactly what's already there.
    const suggestOthers = useCallback(
      (query: string) => suggest(query).filter((item) => item.value !== query),
      [suggest]
    );
    const dropdown = useSuggestions({ query: value, suggest: suggestOthers, onPick: onValueChange, footer });
    const { ref: anchor, ...comboProps } = dropdown.inputProps;
    // The input is both the caller's ref and the dropdown's anchor.
    const setRefs = useCallback(
      (node: HTMLInputElement | null) => {
        anchor(node);
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [anchor, ref]
    );

    return (
      <>
        <Input
          ref={setRefs}
          {...props}
          {...comboProps}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value);
            dropdown.onType();
          }}
          onBlur={(e) => {
            dropdown.close();
            onBlur?.(e);
          }}
          onKeyDown={(e) => {
            if (!dropdown.handleKeyDown(e)) onKeyDown?.(e);
          }}
        />
        {dropdown.list}
      </>
    );
  }
);

SuggestInput.displayName = "SuggestInput";
