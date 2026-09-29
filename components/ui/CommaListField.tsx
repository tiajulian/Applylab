"use client";

import { useMemo, useState, type KeyboardEvent, type SyntheticEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useSuggestions } from "@/components/ui/useSuggestions";
import { suggestFromList } from "@/lib/text/fuzzyMatch";

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
  const items = useMemo(
    () => suggestFromList(segment.current, catalog, segment.others).map((v) => ({ value: v })),
    [segment, catalog]
  );
  const dropdown = useSuggestions(items, (picked) => {
    onValueChange(replaceSegment(value, segment, picked));
    // React moves the cursor to the end when it sets the new value.
    setCaret(null);
  });

  const shared = {
    ...props,
    ...dropdown.inputProps,
    value,
    onBlur: dropdown.close,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      dropdown.handleKeyDown(e);
    },
    onSelect: (e: SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => setCaret(e.currentTarget.selectionStart),
  };

  return (
    <div className="relative">
      {multiline ? (
        <Textarea
          {...shared}
          onChange={(e) => {
            onValueChange(e.target.value);
            setCaret(e.target.selectionStart);
            dropdown.onType();
          }}
        />
      ) : (
        <Input
          {...shared}
          onChange={(e) => {
            onValueChange(e.target.value);
            setCaret(e.target.selectionStart);
            dropdown.onType();
          }}
        />
      )}
      {dropdown.list}
    </div>
  );
}
