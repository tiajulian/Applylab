"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { clsx } from "@/lib/utils";
import { XIcon } from "@/components/ui/icons/LucideIcons";

interface TagInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  max: number;
  placeholder?: string;
  hint?: string;
  error?: string;
  /** Offered as autocomplete; picking one adds it straight away. */
  suggestions?: readonly string[];
}

/** A list of short text values: Enter or comma adds, Backspace on an empty field removes the last. */
export function TagInput({ label, values, onChange, max, placeholder, hint, error, suggestions }: TagInputProps) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const isFull = values.length >= max;

  function add(raw: string) {
    const value = raw.trim().replace(/\s+/g, " ");
    setDraft("");
    if (!value || isFull || values.some((v) => v.toLowerCase() === value.toLowerCase())) return;
    onChange([...values, value]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
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
          "flex flex-wrap items-center gap-1.5 rounded border bg-surface px-2 py-1.5",
          "focus-within:border-accent focus-within:ring-2 focus-within:ring-ring",
          error ? "border-critical" : "border-border"
        )}
      >
        {values.map((value) => (
          <span key={value} className="inline-flex items-center gap-1 rounded-pill bg-paper-deep px-2.5 py-1 text-xs font-medium text-ink">
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== value))}
              className="rounded-pill text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Remove ${value}`}
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          disabled={isFull}
          list={suggestions ? `${id}-suggestions` : undefined}
          placeholder={isFull ? `Up to ${max}` : placeholder}
          onChange={(event) => {
            const value = event.target.value;
            // Picking a datalist option adds it at once; typing a prefix of a longer place
            // ("Perth" on the way to "Perth Hills") must not.
            const native = event.nativeEvent as InputEvent;
            const typed = typeof native.inputType === "string" && native.inputType !== "insertReplacementText";
            if (!typed && suggestions?.includes(value)) add(value);
            else setDraft(value);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-help` : undefined}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm text-ink placeholder:text-ink-muted focus:outline-none disabled:cursor-not-allowed"
        />
        {suggestions && (
          <datalist id={`${id}-suggestions`}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
      </div>
      {(error || hint) && (
        <p id={`${id}-help`} className={clsx("text-xs", error ? "text-critical" : "text-ink-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
