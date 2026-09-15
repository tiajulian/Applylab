"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { useToast } from "@/components/ui/Toast";
import type { Resume, ResumeVersion } from "@/types";

export function VersionHistoryPanel({
  resumeId,
  onRestore,
  open,
}: {
  resumeId: string;
  onRestore: (resume: Resume) => void;
  /** When provided, an external trigger (e.g. VersionHistorySlideOver's toolbar button) owns
   * open/closed state and this component's own "Show history" toggle is hidden - it just loads
   * and renders the list whenever `open` turns true. Omit for the original self-contained toggle. */
  open?: boolean;
}) {
  const { showToast } = useToast();
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isControlled ? open : internalOpen;
  const [isLoading, setIsLoading] = useState(false);
  const [versions, setVersions] = useState<ResumeVersion[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadVersions() {
    setIsLoading(true);
    setError(null);

    const response = await fetch(`/api/resume/${resumeId}/versions`);
    const data = await response.json().catch(() => ({}));
    setIsLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to load version history");
      return;
    }
    setVersions(data.versions ?? []);
  }

  useEffect(() => {
    if (isControlled && isOpen && versions === null) {
      loadVersions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, isOpen]);

  async function handleToggle() {
    const next = !internalOpen;
    setInternalOpen(next);
    if (next && versions === null) {
      await loadVersions();
    }
  }

  async function handleSaveVersion() {
    setIsSaving(true);
    setError(null);

    const response = await fetch(`/api/resume/${resumeId}/versions`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setIsSaving(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to save version");
      return;
    }
    setVersions(data.versions ?? []);
    showToast("Version saved", "success");
  }

  async function handleRestore(versionId: string) {
    setRestoringId(versionId);
    setError(null);

    const response = await fetch(`/api/resume/${resumeId}/versions/${versionId}/restore`, {
      method: "POST",
    });
    const data = await response.json().catch(() => ({}));
    setRestoringId(null);

    if (!response.ok) {
      setError(data.error ?? "Failed to restore version");
      return;
    }

    onRestore(data.resume);
    showToast("Version restored", "accent");
    await loadVersions();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {!isControlled && (
          <Button type="button" variant="outline" size="sm" onClick={handleToggle} isLoading={isLoading}>
            {isOpen ? "Hide history" : "Show history"}
          </Button>
        )}
        {isOpen && (
          <Button type="button" variant="ghost" size="sm" onClick={handleSaveVersion} isLoading={isSaving}>
            Save version
          </Button>
        )}
        {isControlled && isLoading && <span className="text-xs text-ink-muted">Loading...</span>}
      </div>

      {error && <p className="text-xs text-critical">{error}</p>}

      {isOpen && versions && (
        <div className="flex flex-col gap-2 rounded border border-border bg-surface p-4">
          {versions.length === 0 ? (
            <p className="text-sm text-ink-muted">No saved versions yet.</p>
          ) : (
            <StaggerList className="flex flex-col gap-2">
              {versions.map((version) => (
                <StaggerItem key={version.id}>
                  <div className="flex items-center justify-between gap-3 rounded border border-border px-3 py-2 transition-transform duration-fast ease-editorial hover:-translate-y-px">
                    <div className="flex flex-col">
                      <span className="text-sm text-ink-secondary">{version.label || "Version"}</span>
                      <span className="text-xs text-ink-muted">
                        {new Date(version.created_at).toLocaleString("en-AU")}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestore(version.id)}
                      isLoading={restoringId === version.id}
                    >
                      Restore
                    </Button>
                  </div>
                </StaggerItem>
              ))}
            </StaggerList>
          )}
        </div>
      )}
    </div>
  );
}
