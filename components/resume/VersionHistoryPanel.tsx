"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Resume, ResumeVersion } from "@/types";

export function VersionHistoryPanel({
  resumeId,
  onRestore,
}: {
  resumeId: string;
  onRestore: (resume: Resume) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
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

  async function handleToggle() {
    const next = !isOpen;
    setIsOpen(next);
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
    await loadVersions();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={handleToggle} isLoading={isLoading}>
          {isOpen ? "Hide history" : "Show history"}
        </Button>
        {isOpen && (
          <Button type="button" variant="ghost" size="sm" onClick={handleSaveVersion} isLoading={isSaving}>
            Save version
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {isOpen && versions && (
        <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4">
          {versions.length === 0 ? (
            <p className="text-sm text-gray-500">No saved versions yet.</p>
          ) : (
            versions.map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm text-gray-700">{version.label || "Version"}</span>
                  <span className="text-xs text-gray-400">
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
            ))
          )}
        </div>
      )}
    </div>
  );
}
