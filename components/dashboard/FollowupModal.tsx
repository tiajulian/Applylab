"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type { ApplicationFollowup } from "@/types";

interface FollowupModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  companyName: string;
  jobTitle: string;
  initialFollowup?: ApplicationFollowup | null;
}

export function FollowupModal({
  isOpen,
  onClose,
  applicationId,
  companyName,
  jobTitle,
  initialFollowup,
}: FollowupModalProps) {
  const [followup, setFollowup] = useState<ApplicationFollowup | null>(initialFollowup ?? null);
  const [draftText, setDraftText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialFollowup) {
      setFollowup(initialFollowup);
      setDraftText(initialFollowup.edited_text || initialFollowup.draft_text);
    } else {
      // Auto-load or generate
      fetchDraft();
    }
  }, [isOpen, applicationId, initialFollowup]);

  async function fetchDraft() {
    setIsLoading(true);
    setError(null);
    try {
      const getRes = await fetch(`/api/applications/${applicationId}/followup`);
      const getData = await getRes.json();
      if (getData.followup) {
        setFollowup(getData.followup);
        setDraftText(getData.followup.edited_text || getData.followup.draft_text);
        setIsLoading(false);
        return;
      }

      // Generate new draft
      const postRes = await fetch(`/api/applications/${applicationId}/followup`, {
        method: "POST",
      });
      const postData = await postRes.json();
      if (!postRes.ok) {
        throw new Error(postData.error || "Failed to generate draft");
      }
      setFollowup(postData.followup);
      setDraftText(postData.followup.edited_text || postData.followup.draft_text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load follow-up draft");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopy() {
    if (!draftText) return;
    try {
      await navigator.clipboard.writeText(draftText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);

      // Record copied_at timestamp
      if (followup) {
        await fetch(`/api/applications/${applicationId}/followup`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            followup_id: followup.id,
            copied_at: new Date().toISOString(),
            edited_text: draftText !== followup.draft_text ? draftText : undefined,
          }),
        });
      }
    } catch (err) {
      console.error("Failed to copy", err);
    }
  }

  async function handleSaveEdited() {
    if (!followup) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/followup`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followup_id: followup.id,
          edited_text: draftText,
        }),
      });
      const data = await res.json();
      if (res.ok && data.followup) {
        setFollowup(data.followup);
      }
    } catch (err) {
      console.error("Failed to save edited draft", err);
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  // Parse subject and body for mailto link
  let subjectLine = `Following up on ${jobTitle} application`;
  let bodyText = draftText;
  const match = draftText.match(/^Subject:\s*(.+)\n\n([\s\S]*)$/i);
  if (match) {
    subjectLine = match[1];
    bodyText = match[2];
  }
  const mailtoHref = `mailto:?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(bodyText)}`;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-fast"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl animate-in zoom-in-95 duration-fast">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">
              Follow-up email draft
            </h3>
            <p className="mt-0.5 text-xs text-ink-secondary">
              {jobTitle} &bull; {companyName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-muted hover:bg-paper-deep hover:text-ink"
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-sm text-ink-secondary">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="mt-3">Drafting follow-up email...</p>
          </div>
        ) : error ? (
          <div className="my-6 rounded bg-critical-soft p-4 text-xs text-critical">
            <p>{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={fetchDraft}
            >
              Try again
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <Textarea
              rows={8}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              className="font-sans text-xs leading-relaxed"
              placeholder="Email draft will appear here..."
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCopy}
                  className={copied ? "bg-success text-on-accent hover:bg-success" : ""}
                >
                  {copied ? "Copied! ✓" : "Copy email"}
                </Button>
                <a
                  href={mailtoHref}
                  className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-paper-deep"
                >
                  Open in mail client &rarr;
                </a>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={fetchDraft}
                  disabled={isLoading}
                >
                  Regenerate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
