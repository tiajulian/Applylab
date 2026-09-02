"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  SparklesIcon,
  TrashIcon,
} from "@/components/ui/icons/LucideIcons";
import type { AssistAction } from "@/lib/anthropic/assistBullet";

const ACTION_OPTIONS: { action: AssistAction; label: string; desc: string }[] = [
  { action: "rewrite", label: "Rewrite", desc: "Sharpen impact and clarity" },
  { action: "quantify", label: "Quantify", desc: "Highlight numbers and metrics" },
  { action: "shorten", label: "Shorten", desc: "Make concise and direct" },
  { action: "senior", label: "More senior", desc: "Elevate leadership and ownership" },
];

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [options, setOptions] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const bulletText = value ?? "";

  // Auto-grow textarea on value or input change
  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(38, textareaRef.current.scrollHeight)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [bulletText]);

  // Close improve menu on click outside or escape
  useEffect(() => {
    if (!isMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  async function runAssist(action: AssistAction) {
    if (!bulletText.trim()) return;
    setIsMenuOpen(false);
    setIsLoading(true);
    setError(null);
    setOptions(null);
    setLimitReached(false);

    try {
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
    } catch {
      setIsLoading(false);
      setError("Request timed out. Please try again.");
    }
  }

  return (
    <motion.div
      className="group relative flex flex-col gap-1.5 rounded-lg border border-border/70 bg-surface p-2.5 transition-colors focus-within:border-accent/60"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="flex items-start gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          placeholder="Describe your achievement or responsibility..."
          onChange={(e) => {
            onChange(e.target.value);
            setError(null);
            setLimitReached(false);
          }}
          className="flex-1 resize-none overflow-hidden bg-transparent p-0 text-sm leading-relaxed text-ink placeholder:text-ink-muted/50 focus:outline-none"
        />

        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          {onMoveUp && (
            <button
              type="button"
              aria-label="Move bullet up"
              title="Move up"
              className="rounded p-1 text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={onMoveUp}
            >
              <ArrowUpIcon className="h-3.5 w-3.5" strokeWidth={2.75} />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              aria-label="Move bullet down"
              title="Move down"
              className="rounded p-1 text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={onMoveDown}
            >
              <ArrowDownIcon className="h-3.5 w-3.5" strokeWidth={2.75} />
            </button>
          )}
          <button
            type="button"
            aria-label="Remove bullet"
            title="Remove"
            className="rounded p-1 text-ink-muted transition-colors hover:bg-critical/10 hover:text-critical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onRemove}
          >
            <TrashIcon className="h-3.5 w-3.5" strokeWidth={2.75} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border/40">
        {/* Single Improve Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            disabled={isLoading || !bulletText.trim()}
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-pill border border-border/80 bg-paper/50 px-2.5 py-1 text-xs font-medium text-ink-secondary transition-colors duration-fast ease-editorial hover:border-accent hover:bg-accent-soft/30 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SparklesIcon className="h-3 w-3 text-accent shrink-0" strokeWidth={2.75} />
            <span>{isLoading ? "Improving..." : "Improve"}</span>
            <span className="text-[10px] text-ink-muted">▾</span>
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
                className="absolute left-0 z-20 mt-1.5 w-48 rounded-lg border border-border bg-surface p-1 shadow-pop"
                role="menu"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.action}
                    type="button"
                    role="menuitem"
                    onClick={() => runAssist(opt.action)}
                    className="flex w-full flex-col rounded px-2.5 py-1.5 text-left transition-colors hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="text-xs font-medium text-ink">{opt.label}</span>
                    <span className="text-[10px] text-ink-muted">{opt.desc}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <span className="text-[11px] text-ink-muted">
          {value.trim() ? `${value.trim().split(/\s+/).length} words` : "Empty"}
        </span>
      </div>

      {limitReached && (
        <p className="text-xs text-attention mt-1">
          AI assist limit reached for this resume.{" "}
          <Link href="/upgrade" className="font-medium underline">
            Upgrade for unlimited assist
          </Link>
          .
        </p>
      )}

      {error && <p className="text-xs text-critical mt-1">{error}</p>}

      {options && options.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-accent/30 bg-accent-soft/40 p-2.5 mt-1">
          <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
            AI Suggestions
          </span>
          {options.map((option, i) => (
            <button
              key={i}
              type="button"
              className="rounded bg-surface p-2 text-left text-xs leading-relaxed text-ink shadow-xs transition-colors hover:bg-paper-deep hover:border-accent/40 border border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            className="self-start text-[11px] text-ink-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pt-0.5"
            onClick={() => setOptions(null)}
          >
            Dismiss
          </button>
        </div>
      )}
    </motion.div>
  );
}

