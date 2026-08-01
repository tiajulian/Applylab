"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { AssistAction } from "@/lib/anthropic/assistBullet";

const ACTION_LABELS: Record<AssistAction, string> = {
  rewrite: "Rewrite",
  quantify: "Quantify",
  shorten: "Shorten",
  senior: "More senior",
};

export function BulletEditor({
  resumeId,
  roleTitle,
  roleCompany,
  value,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  resumeId: string;
  roleTitle?: string;
  roleCompany?: string;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  async function runAssist(action: AssistAction) {
    if (!value.trim()) return;
    setIsLoading(true);
    setError(null);
    setOptions(null);
    setLimitReached(false);

    const response = await fetch(`/api/resume/${resumeId}/assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bulletText: value, action, roleTitle, roleCompany }),
    });

    const data = await response.json().catch(() => ({}));
    setIsLoading(false);

    if (!response.ok) {
      if (response.status === 403) {
        setLimitReached(true);
        return;
      }
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    setOptions(data.options ?? []);
  }

  return (
    <motion.div
      className="flex flex-col gap-1.5"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="flex items-start gap-2">
        <textarea
          rows={2}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setError(null);
            setLimitReached(false);
          }}
          className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-ink transition-[border-color,box-shadow] duration-fast ease-editorial focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex flex-col gap-1">
          {onMoveUp && (
            <button
              type="button"
              className="text-xs text-ink-muted transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={onMoveUp}
            >
              ↑
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              className="text-xs text-ink-muted transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={onMoveDown}
            >
              ↓
            </button>
          )}
          <button
            type="button"
            className="text-xs text-critical/70 transition-colors duration-fast ease-editorial hover:text-critical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onRemove}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(ACTION_LABELS) as AssistAction[]).map((action) => (
          <button
            key={action}
            type="button"
            disabled={isLoading || !value.trim()}
            onClick={() => runAssist(action)}
            className="rounded-pill border border-border px-2.5 py-1 text-xs text-ink-secondary transition-colors duration-fast ease-editorial hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isLoading ? "…" : ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      {limitReached && (
        <p className="text-xs text-attention">
          AI-assist limit reached for this resume.{" "}
          <Link href="/upgrade" className="font-medium underline">
            Upgrade for unlimited assist
          </Link>
          .
        </p>
      )}
      {error && <p className="text-xs text-critical">{error}</p>}

      {options && options.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded border border-accent-soft bg-accent-soft p-2">
          {options.map((option, i) => (
            <button
              key={i}
              type="button"
              className="rounded bg-surface p-2 text-left text-xs text-ink shadow-sm hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                onChange(option);
                setOptions(null);
                setError(null);
                setLimitReached(false);
              }}
            >
              {option}
            </button>
          ))}
          <button
            type="button"
            className="self-start text-xs text-ink-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setOptions(null)}
          >
            Dismiss
          </button>
        </div>
      )}
    </motion.div>
  );
}
