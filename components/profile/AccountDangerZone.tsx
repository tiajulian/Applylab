"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const CONFIRM_PHRASE = "DELETE";

export function AccountDangerZone() {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setError(null);

    const response = await fetch("/api/account/export");

    if (!response.ok) {
      setIsExporting(false);
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to export your data. Please try again.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "applylab-data-export.json";
    link.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
  }

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);

    const response = await fetch("/api/account/delete", { method: "POST" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setIsDeleting(false);
      setError(data.error ?? "Failed to delete your account. Please try again.");
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Card>
      <h2 className="text-h3 font-semibold text-ink">Your data</h2>
      <p className="mt-1 text-sm text-ink-secondary">
        Download everything applylab has stored for you, or permanently delete your account.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" variant="outline" size="sm" onClick={handleExport} isLoading={isExporting}>
          Download my data
        </Button>
        {!showConfirm && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowConfirm(true)}>
            Delete my account
          </Button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-critical">{error}</p>}

      {showConfirm && (
        <div className="mt-4 flex flex-col gap-3 rounded border border-critical/30 bg-critical-soft p-4">
          <p className="text-sm text-critical">
            This permanently deletes your account, profile, every resume and cover letter, your
            application tracker, and your billing details. This cannot be undone. Type{" "}
            <span className="font-semibold">{CONFIRM_PHRASE}</span> to confirm.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-40 rounded border border-critical/30 bg-surface px-3 py-1.5 text-sm text-ink transition-[border-color,box-shadow] duration-fast ease-editorial focus:border-critical focus:outline-none focus:ring-2 focus:ring-critical/20"
            placeholder={CONFIRM_PHRASE}
            aria-label={`Type ${CONFIRM_PHRASE} to confirm account deletion`}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={confirmText !== CONFIRM_PHRASE || isDeleting}
              onClick={handleDelete}
              className="inline-flex items-center justify-center gap-2 rounded bg-critical px-4 py-2 text-sm font-medium text-on-accent transition-[background-color,transform,opacity] duration-fast ease-editorial hover:-translate-y-px hover:bg-critical/90 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {isDeleting ? "Deleting…" : "Permanently delete my account"}
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowConfirm(false);
                setConfirmText("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
