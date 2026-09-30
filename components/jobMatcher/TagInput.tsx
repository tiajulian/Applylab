"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { clsx } from "@/lib/utils";
import { XIcon } from "@/components/ui/icons/LucideIcons";
import { useSuggestions, type Suggestion } from "@/components/ui/useSuggestions";

interface TagInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  max: number;
  placeholder?: string;
  hint?: string;
  error?: string;
  /** Suggestions for the text typed so far; picking one adds it straight away. */
  suggest?: (draft: string) => Suggestion[];
  onFocus?: () => void;
  /** Whether a comma adds the tag (default). Off for places, written "Suburb, STATE". */
  commaAdds?: boolean;
}

/** A list of short text values: Enter (or a comma) adds, Backspace on an empty field removes the last. */
export function TagInput({ label, values, onChange, max, placeholder, hint, error, suggest, onFocus, commaAdds = true }: TagInputProps) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const isFull = values.length >= max;

  function add(raw: string) {
    const value = raw.trim().replace(/\s+/g, " ");
    setDraft("");
    if (!value || isFull || values.some((v) => v.toLowerCase() === value.toLowerCase())) return;
    onChange([...values, value]);
  }

  const items = useMemo(() => {
    if (!suggest) return [];
    const chosen = new Set(values.map((v) => v.toLowerCase()));
    return suggest(draft).filter((item) => !chosen.has(item.value.toLowerCase()));
  }, [suggest, draft, values]);
  const dropdown = useSuggestions(items, add);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (dropdown.handleKeyDown(event)) return;
    if (event.key === "Enter" || (commaAdds && event.key === ",")) {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-secondary">
        {label} <span className="font-normal text-ink-muted">({values.length}/{max})</span>
      </label>
      <div
        className={clsx(
          "flex min-h-[44px] flex-wrap items-center gap-1.5 rounded border bg-surface px-2 py-1.5 transition-[border-color,box-shadow] duration-fast ease-editorial",
          "focus-within:border-accent focus-within:ring-2 focus-within:ring-ring",
          error ? "border-critical" : "border-border"
        )}
      >
        {values.map((value) => (
          <span key={value} className="inline-flex items-center gap-1.5 rounded-pill bg-paper-deep py-1 pl-3 pr-2 text-sm font-medium text-ink">
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== value))}
              className="rounded-pill text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Remove ${value}`}
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          disabled={isFull}
          ref={dropdown.anchor}
          {...(suggest ? dropdown.inputProps : {})}
          placeholder={isFull ? `Up to ${max}` : placeholder}
          onChange={(event) => {
            setDraft(event.target.value);
            dropdown.onType();
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            dropdown.open();
            onFocus?.();
          }}
          onBlur={() => {
            dropdown.close();
            add(draft);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-help` : undefined}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm text-ink placeholder:text-ink-muted focus:outline-none disabled:cursor-not-allowed"
        />
        {dropdown.list}
      </div>
      {(error || hint) && (
        <p id={`${id}-help`} className={clsx("text-xs", error ? "text-critical" : "text-ink-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
