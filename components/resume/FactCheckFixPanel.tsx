"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import type { ClientFixResolution } from "@/lib/resume/applyFix";
import type { FactCheckFlag, Resume, ResumeContent } from "@/types";

const POPOVER_WIDTH = 340;
const VIEWPORT_MARGIN = 16;

type BulletTarget = { kind: "experienceBullet" | "projectBullet"; index: number; bulletIndex: number };

type FlagAction =
  | { type: "resolution"; label: string; resolution: ClientFixResolution }
  | { type: "captureEvidence"; label: string }
  | { type: "confirmBridge"; label: string; bridgeItemId: string }
  | { type: "assistRemove"; label: string; detail: string; target: BulletTarget };

/**
 * Classifies a single flag into the honest fixes it allows - Remove, Align to source, or Capture
 * the real evidence, and ONLY these (see the spec's core invariant). Mirrors the exact mapping
 * worked out in the build spec: target.kind/field plus a couple of flag.message substring checks
 * (the same substrings factCheck.ts's own messages already contain, not new classification logic
 * duplicating factCheck.ts's decisions - just reading which check produced this flag).
 */
function actionsForFlag(flag: FactCheckFlag): FlagAction[] {
  const target = flag.target;
  if (!target) return [];

  switch (target.kind) {
    case "experienceHeader": {
      if (target.field === "role") {
        return [{ type: "resolution", label: "Remove this role", resolution: { kind: "removeExperience", index: target.index } }];
      }
      if (target.field === "dates") {
        return [
          { type: "resolution", label: "Align to your profile", resolution: { kind: "alignExperienceDates", index: target.index } },
        ];
      }
      return [
        {
          type: "resolution",
          label: "Align to your profile",
          resolution: { kind: "alignExperienceField", index: target.index, field: target.field },
        },
      ];
    }

    case "projectHeader": {
      if (target.field === "project") {
        return [{ type: "resolution", label: "Remove this project", resolution: { kind: "removeProject", index: target.index } }];
      }
      if (target.field === "year") {
        return [
          { type: "resolution", label: "Align to your profile", resolution: { kind: "alignProjectYear", index: target.index } },
        ];
      }
      return [
        { type: "resolution", label: "Align to your profile", resolution: { kind: "alignProjectTitle", index: target.index } },
      ];
    }

    case "education":
      return [
        {
          type: "resolution",
          label: "Align to your profile",
          resolution: { kind: "alignEducationField", index: target.index, field: target.field },
        },
      ];

    case "skill":
    case "tool": {
      const actions: FlagAction[] = [
        {
          type: "resolution",
          label: target.kind === "skill" ? "Remove this skill" : "Remove this tool",
          resolution: target.kind === "skill" ? { kind: "removeSkill", index: target.index } : { kind: "removeTool", index: target.index },
        },
      ];
      if (flag.message.includes("doesn't trace to anything in your profile")) {
        actions.push({ type: "captureEvidence", label: "I have this" });
      }
      if (flag.relatedBridgeItemId) {
        actions.push({ type: "confirmBridge", label: "Confirm in Skills Bridge", bridgeItemId: flag.relatedBridgeItemId });
      }
      return actions;
    }

    case "experienceBullet":
    case "projectBullet": {
      const bulletTarget: BulletTarget = { kind: target.kind, index: target.index, bulletIndex: target.bulletIndex };
      const actions: FlagAction[] = [
        {
          type: "resolution",
          label: "Remove bullet",
          resolution:
            target.kind === "experienceBullet"
              ? { kind: "removeExperienceBullet", index: target.index, bulletIndex: target.bulletIndex }
              : { kind: "removeProjectBullet", index: target.index, bulletIndex: target.bulletIndex },
        },
      ];
      if (flag.relatedBridgeItemId) {
        actions.push({ type: "confirmBridge", label: "Confirm in Skills Bridge", bridgeItemId: flag.relatedBridgeItemId });
      }
      actions.push({ type: "assistRemove", label: "Remove just this detail", detail: flag.value, target: bulletTarget });
      return actions;
    }

    case "summary":
      // The duration_claim synthetic gate flag has no precise span (value is "") - nothing safe
      // to auto-remove, so no button; the caption above already tells the user what to check.
      return flag.value
        ? [{ type: "resolution", label: "Remove this phrase", resolution: { kind: "removeSummaryPhrase", phrase: flag.value } }]
        : [];

    case "referee":
      return [{ type: "resolution", label: "Remove this referee", resolution: { kind: "removeReferee", index: target.index } }];
  }
}

function bulletContext(resume: ResumeContent, target: BulletTarget): { text: string; roleTitle?: string; roleCompany?: string } {
  if (target.kind === "experienceBullet") {
    const entry = resume.experience[target.index];
    return { text: entry?.bullets[target.bulletIndex] ?? "", roleTitle: entry?.job_title, roleCompany: entry?.company };
  }
  const entry = resume.projects[target.index];
  return { text: entry?.bullets[target.bulletIndex] ?? "", roleTitle: entry?.title, roleCompany: entry?.context };
}

function computePopoverStyle(anchorRect: DOMRect): React.CSSProperties {
  if (typeof window === "undefined") {
    return { position: "fixed", top: anchorRect.bottom + 8, left: anchorRect.left, width: POPOVER_WIDTH };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(Math.max(anchorRect.left, VIEWPORT_MARGIN), Math.max(vw - POPOVER_WIDTH - VIEWPORT_MARGIN, VIEWPORT_MARGIN));

  const spaceBelow = vh - anchorRect.bottom;
  const openAbove = spaceBelow < 240 && anchorRect.top > 240;
  if (openAbove) {
    return { position: "fixed", left, bottom: Math.max(vh - anchorRect.top + 8, VIEWPORT_MARGIN), width: POPOVER_WIDTH };
  }
  return { position: "fixed", left, top: Math.min(anchorRect.bottom + 8, vh - VIEWPORT_MARGIN), width: POPOVER_WIDTH };
}

export function FactCheckFixPanel({
  flags,
  anchorRect,
  resumeId,
  resumeContent,
  skillsBridgeId,
  onClose,
  onApplied,
}: {
  flags: FactCheckFlag[];
  anchorRect: DOMRect | null;
  resumeId: string;
  resumeContent: ResumeContent;
  skillsBridgeId: string | null;
  onClose: () => void;
  onApplied: (updatedResume: Resume) => void;
}) {
  const isMobile = useIsMobile();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captureOpenKey, setCaptureOpenKey] = useState<string | null>(null);
  const [captureNotes, setCaptureNotes] = useState<Record<string, string>>({});
  const [assistLoadingKey, setAssistLoadingKey] = useState<string | null>(null);
  const [assistOptions, setAssistOptions] = useState<Record<string, string[]>>({});
  const [assistTried, setAssistTried] = useState<Record<string, boolean>>({});

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function postFix(resolution: unknown): Promise<Resume> {
    const response = await fetch(`/api/resume/${resumeId}/fix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error ?? "Something went wrong. Please try again.");
    }
    return data.resume as Resume;
  }

  async function handleResolution(resolution: ClientFixResolution, buttonKey: string) {
    setLoadingKey(buttonKey);
    setError(null);
    try {
      const updated = await postFix(resolution);
      onApplied(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleCaptureEvidence(flagKey: string, note: string) {
    if (!note.trim()) return;
    const buttonKey = `${flagKey}-capture`;
    setLoadingKey(buttonKey);
    setError(null);
    try {
      const updated = await postFix({ kind: "captureEvidence", note });
      onApplied(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleConfirmBridge(bridgeItemId: string, buttonKey: string) {
    if (!skillsBridgeId) return;
    setLoadingKey(buttonKey);
    setError(null);
    try {
      const patchResponse = await fetch(`/api/skills-bridge/${skillsBridgeId}/items/${bridgeItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_state: "confirmed" }),
      });
      if (!patchResponse.ok) {
        const data = await patchResponse.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to confirm in Skills Bridge");
      }
      const updated = await postFix({ kind: "recheck" });
      onApplied(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleAssistRemove(flagKey: string, detail: string, target: BulletTarget) {
    setAssistLoadingKey(flagKey);
    setError(null);
    try {
      const { text, roleTitle, roleCompany } = bulletContext(resumeContent, target);
      const response = await fetch(`/api/resume/${resumeId}/assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulletText: text, action: "trim_unsupported", unsupportedDetail: detail, roleTitle, roleCompany }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setAssistOptions((prev) => ({ ...prev, [flagKey]: data.options ?? [] }));
      setAssistTried((prev) => ({ ...prev, [flagKey]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setAssistLoadingKey(null);
    }
  }

  async function handleAssistApply(target: BulletTarget, text: string, buttonKey: string) {
    const resolution: ClientFixResolution =
      target.kind === "experienceBullet"
        ? { kind: "replaceExperienceBullet", index: target.index, bulletIndex: target.bulletIndex, text }
        : { kind: "replaceProjectBullet", index: target.index, bulletIndex: target.bulletIndex, text };
    await handleResolution(resolution, buttonKey);
  }

  const anyBusy = loadingKey !== null;

  function renderAction(action: FlagAction, flagKey: string, actionKey: string) {
    switch (action.type) {
      case "resolution":
        return (
          <Button
            key={actionKey}
            type="button"
            variant="outline"
            size="sm"
            isLoading={loadingKey === actionKey}
            disabled={anyBusy && loadingKey !== actionKey}
            onClick={() => handleResolution(action.resolution, actionKey)}
          >
            {action.label}
          </Button>
        );
      case "confirmBridge":
        return skillsBridgeId ? (
          <Button
            key={actionKey}
            type="button"
            variant="outline"
            size="sm"
            isLoading={loadingKey === actionKey}
            disabled={anyBusy && loadingKey !== actionKey}
            onClick={() => handleConfirmBridge(action.bridgeItemId, actionKey)}
          >
            {action.label}
          </Button>
        ) : null;
      case "captureEvidence":
        return (
          <Button
            key={actionKey}
            type="button"
            variant="outline"
            size="sm"
            disabled={anyBusy}
            onClick={() => setCaptureOpenKey((current) => (current === flagKey ? null : flagKey))}
          >
            {action.label}
          </Button>
        );
      case "assistRemove":
        return (
          <Button
            key={actionKey}
            type="button"
            variant="outline"
            size="sm"
            isLoading={assistLoadingKey === flagKey}
            disabled={anyBusy || (assistLoadingKey !== null && assistLoadingKey !== flagKey)}
            onClick={() => handleAssistRemove(flagKey, action.detail, action.target)}
          >
            {action.label}
          </Button>
        );
    }
  }

  const content = (
    <div className="flex flex-col gap-3">
      {flags.map((flag, i) => {
        const flagKey = `flag-${i}`;
        const actions = actionsForFlag(flag);
        return (
          <div key={flagKey} className="flex flex-col gap-2 rounded border border-attention/30 bg-attention-soft p-3">
            <p className="text-sm text-attention">{flag.message}</p>
            {actions.length === 0 && (
              <p className="text-xs text-ink-muted">Edit the summary directly to adjust this.</p>
            )}
            {actions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {actions.map((action, ai) => renderAction(action, flagKey, `${flagKey}-${ai}`))}
              </div>
            )}

            {captureOpenKey === flagKey && (
              <div className="flex flex-col gap-2 rounded border border-border bg-surface p-2">
                <p className="text-xs text-ink-secondary">Where does this come from? Add the detail to your profile.</p>
                <Textarea
                  rows={2}
                  value={captureNotes[flagKey] ?? ""}
                  onChange={(e) => setCaptureNotes((notes) => ({ ...notes, [flagKey]: e.target.value }))}
                  className="text-xs"
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCaptureOpenKey(null)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    isLoading={loadingKey === `${flagKey}-capture`}
                    disabled={!captureNotes[flagKey]?.trim()}
                    onClick={() => handleCaptureEvidence(flagKey, captureNotes[flagKey] ?? "")}
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}

            {(assistOptions[flagKey]?.length ?? 0) > 0 && (
              <div className="flex flex-col gap-1.5 rounded border border-accent-soft bg-accent-soft p-2">
                {assistOptions[flagKey].map((option, oi) => {
                  const action = actions.find((a): a is Extract<FlagAction, { type: "assistRemove" }> => a.type === "assistRemove");
                  if (!action) return null;
                  const applyKey = `${flagKey}-apply-${oi}`;
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={anyBusy}
                      className="rounded bg-surface p-2 text-left text-xs text-ink shadow-sm hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => handleAssistApply(action.target, option, applyKey)}
                    >
                      {option}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="self-start text-xs text-ink-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setAssistOptions((prev) => ({ ...prev, [flagKey]: [] }))}
                >
                  Dismiss
                </button>
              </div>
            )}
            {assistTried[flagKey] && (assistOptions[flagKey]?.length ?? 0) === 0 && (
              <p className="text-xs text-ink-muted">No safe automatic removal found. Use &quot;Remove bullet&quot; instead.</p>
            )}
          </div>
        );
      })}

      {error && <p className="text-xs text-critical">{error}</p>}

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );

  if (anchorRect === null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
        <motion.div
          className="absolute inset-0 bg-ink/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        />
        <motion.div
          className="relative max-h-[80vh] w-full max-w-md overflow-y-auto rounded bg-surface p-6 shadow-pop"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="font-display text-h3 text-ink">Review this detail</h2>
          <div className="mt-4">{content}</div>
        </motion.div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50" onClick={onClose}>
        <motion.div
          className="absolute inset-0 bg-ink/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        />
        <motion.div
          className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-surface p-6 shadow-pop [&_button]:py-3"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="font-display text-h3 text-ink">Review this detail</h2>
          <div className="mt-4">{content}</div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <motion.div
        className="absolute inset-0 bg-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      />
      <motion.div
        style={computePopoverStyle(anchorRect)}
        className="z-50 max-h-[70vh] overflow-y-auto rounded border border-border bg-surface p-4 shadow-pop"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </motion.div>
    </div>
  );
}
