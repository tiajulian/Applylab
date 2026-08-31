"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type { FeedbackType } from "@/types";

const TYPE_OPTIONS: Array<{ value: FeedbackType; label: string; placeholder: string }> = [
  { value: "feature", label: "Feature idea", placeholder: "What would you like ApplyLab to do?" },
  { value: "bug", label: "Something's broken", placeholder: "What happened, and what did you expect instead?" },
  { value: "complaint", label: "Complaint", placeholder: "What's frustrating you?" },
  { value: "other", label: "Something else", placeholder: "What's on your mind?" },
];

export function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<FeedbackType>("feature");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    textareaRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, message: message.trim(), page_url: pathname }),
    }).catch(() => null);

    setIsSubmitting(false);

    if (!response || !response.ok) {
      const data = await response?.json().catch(() => ({}));
      setError(data?.error ?? "Couldn't send that — please try again.");
      return;
    }

    setIsSubmitted(true);
  }

  const activeType = TYPE_OPTIONS.find((option) => option.value === type) ?? TYPE_OPTIONS[0];

  // Rendered via portal into document.body: this component is opened from inside the
  // dashboard header (UserAvatarMenu), and that header has backdrop-blur — which per the CSS
  // spec makes it a containing block for `position: fixed` descendants. Without the portal, the
  // "fixed inset-0" overlay below resolves relative to the header's box instead of the
  // viewport, so the modal renders clipped to the header instead of covering the page.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <motion.div
        className="absolute inset-0 bg-ink/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        className="relative w-full max-w-md rounded bg-surface p-6 shadow-pop"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {isSubmitted ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="text-2xl">🙌</span>
            <h2 className="font-display text-h3 text-ink">Thanks — got it.</h2>
            <p className="text-sm text-ink-secondary">
              We read every submission. It won&rsquo;t get a personal reply, but it directly shapes what we build next.
            </p>
            <Button type="button" size="sm" onClick={onClose} className="mt-2">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <h2 id="feedback-modal-title" className="font-display text-h3 text-ink">
                Send feedback
              </h2>
              <p className="mt-1 text-sm text-ink-secondary">
                Report a bug, request a feature, or tell us what&rsquo;s not working for you.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value)}
                  className={`rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors duration-fast ease-editorial ${
                    type === option.value
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border text-ink-secondary hover:bg-paper-deep"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={activeType.placeholder}
              rows={5}
              maxLength={4000}
              required
            />

            {error && <p className="text-sm text-critical">{error}</p>}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={isSubmitting} disabled={!message.trim()}>
                Send
              </Button>
            </div>
          </form>
        )}
      </motion.div>
    </div>,
    document.body
  );
}
