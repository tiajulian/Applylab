"use client";

import { useCallback, useMemo, useState, type ChangeEvent, type KeyboardEvent, type SyntheticEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useSuggestions } from "@/components/ui/useSuggestions";
import { suggestionsFromList } from "@/lib/text/fuzzyMatch";
import { useStableArray } from "@/lib/hooks/useStableArray";

interface CommaListFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Values to suggest for the item being typed, most common first. Pass a module-level constant. */
  catalog: readonly string[];
  /** A multi-line Textarea instead of a single-line Input. */
  multiline?: boolean;
  id?: string;
  label?: string;
  placeholder?: string;
  rows?: number;
  className?: string;
  "aria-labelledby"?: string;
}

interface Segment {
  /** The item the cursor is in, trimmed. */
  current: string;
  /** Every other item, to leave out of the suggestions. */
  others: string[];
  start: number;
  end: number;
}

/** The comma-separated item around `caret` - the one being typed or edited. */
function segmentAt(value: string, caret: number): Segment {
  const start = value.lastIndexOf(",", caret - 1) + 1;
  const comma = value.indexOf(",", caret);
  const end = comma === -1 ? value.length : comma;
  const others = (value.slice(0, start) + value.slice(end)).split(",").map((p) => p.trim()).filter(Boolean);
  return { current: value.slice(start, end).trim(), others, start, end };
}

/** `value` with the item at `segment` replaced by `picked`; ", " follows when it was the last item. */
function replaceSegment(value: string, { start, end }: Segment, picked: string): string {
  const before = value.slice(0, start).trimEnd();
  const after = value.slice(end);
  return `${before ? `${before} ` : ""}${picked}${after ? after : ", "}`;
}

/**
 * A comma-separated list typed as plain text ("SQL, Excel, Stakeholder Management") that suggests
 * for the item the cursor is in; picking one completes that item (and adds ", " after the last).
 */
export function CommaListField({ value, onValueChange, catalog, multiline, ...props }: CommaListFieldProps) {
  // Where the cursor is, so editing an item mid-list suggests for that item, not the last one.
  const [caret, setCaret] = useState<number | null>(null);
  const segment = useMemo(() => segmentAt(value, Math.min(caret ?? value.length, value.length)), [value, caret]);
  // Stable while only the current item changes (segmentAt builds a new array every keystroke), so
  // `suggest` stays the same and the search isn't redone in the urgent render.
  const others = useStableArray(segment.others);
  const suggest = useCallback((query: string) => suggestionsFromList(query, catalog, others), [catalog, others]);
  const dropdown = useSuggestions({
    query: segment.current,
    suggest,
    onPick: (picked) => {
      onValueChange(replaceSegment(value, segment, picked));
      // React moves the cursor to the end when it sets the new value.
      setCaret(null);
    },
    // In a textarea ArrowDown moves between lines.
    arrowOpens: !multiline,
  });

  // A textarea keeps its textbox role (ARIA allows no combobox role on it): only the ref and the
  // attributes that point assistive tech at the list and its highlighted option.
  const { inputProps } = dropdown;
  const comboProps = multiline
    ? {
        ref: inputProps.ref,
        "aria-controls": inputProps["aria-controls"],
        "aria-activedescendant": inputProps["aria-activedescendant"],
        autoComplete: inputProps.autoComplete,
      }
    : inputProps;

  const shared = {
    ...props,
    ...comboProps,
    value,
    onBlur: () => {
      dropdown.close();
      // A pick leaves ", " ready for the next item - not part of the value once the field is left.
      // Only when focus moved elsewhere on the page: switching tab or app also blurs, and the
      // person comes back to type the next item right there.
      if (document.hasFocus() && /,\s*$/.test(value)) onValueChange(value.replace(/[,\s]+$/, ""));
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      dropdown.handleKeyDown(e);
    },
    onSelect: (e: SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => setCaret(e.currentTarget.selectionStart),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onValueChange(e.target.value);
      setCaret(e.target.selectionStart);
      dropdown.open();
    },
  };

  return (
    <>
      {multiline ? <Textarea {...shared} /> : <Input {...shared} />}
      {dropdown.list}
    </>
  );
}
