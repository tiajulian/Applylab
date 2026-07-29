"use client";

import { useState } from "react";
import Link from "next/link";
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <textarea
          rows={2}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setError(null);
            setLimitReached(false);
          }}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <div className="flex flex-col gap-1">
          {onMoveUp && (
            <button type="button" className="text-xs text-gray-400 hover:text-gray-700" onClick={onMoveUp}>
              ↑
            </button>
          )}
          {onMoveDown && (
            <button type="button" className="text-xs text-gray-400 hover:text-gray-700" onClick={onMoveDown}>
              ↓
            </button>
          )}
          <button type="button" className="text-xs text-red-500 hover:text-red-700" onClick={onRemove}>
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
            className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "…" : ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      {limitReached && (
        <p className="text-xs text-amber-700">
          AI-assist limit reached for this resume —{" "}
          <Link href="/upgrade" className="font-medium underline">
            upgrade for unlimited assist
          </Link>
          .
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {options && options.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-brand-100 bg-brand-50 p-2">
          {options.map((option, i) => (
            <button
              key={i}
              type="button"
              className="rounded-md bg-white p-2 text-left text-xs text-gray-800 shadow-sm hover:bg-brand-100"
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
            className="self-start text-xs text-gray-500 hover:underline"
            onClick={() => setOptions(null)}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
