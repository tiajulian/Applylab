"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { SparklesIcon } from "@/components/ui/icons/LucideIcons";
import { FreeUsesLeft } from "@/components/upgrade/FreeUsesLeft";
import { LimitReachedInline } from "@/components/upgrade/LimitReachedInline";
import { CanvasSheet } from "@/components/resume/canvas/CanvasSheet";
import { refreshFreeUsage } from "@/lib/hooks/useFreeUsesLeft";
import { trackFunnelEvent } from "@/lib/analytics";
import { clsx } from "@/lib/utils";
import type { ProjectEnhanceRequest, ProjectEnhanceResponse } from "@/app/api/projects/enhance/route";
import type { ResumeProjectEntry } from "@/types";

type Status = "form" | "loading" | "ready" | "limit-reached";

/**
 * Bullets for one project from three plain questions. The user ticks which suggested bullets to
 * add; nothing lands on the resume until then, and each can be reworded on the page afterwards.
 */
export function ProjectHelpPanel({
  project,
  onAdd,
  onClose,
}: {
  project: ResumeProjectEntry;
  /** `replace`: the new bullets take the place of the project's current ones (undo brings them back). */
  onAdd: (bullets: string[], replace: boolean) => void;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<Status>("form");
  const [whatItWas, setWhatItWas] = useState("");
  // The project's own bullets are the best starting answer to "what did you do".
  const [whatYouDid, setWhatYouDid] = useState(() => project.bullets.filter((b) => b.trim()).join("\n"));
  const hadBullets = project.bullets.some((b) => b.trim());
  // They were the answer the new bullets were written from, so keeping both would say it twice.
  const [replace, setReplace] = useState(hadBullets);
  const [result, setResult] = useState("");
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bullets, setBullets] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sentFrom, setSentFrom] = useState<string | null>(null);
  const changedSince = sentFrom !== null && JSON.stringify(project) !== sentFrom;
  const abortRef = useRef<AbortController | null>(null);
  const whatYouDidRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    trackFunnelEvent("project_help_opened", { hasBullets: hadBullets });
    return () => abortRef.current?.abort();
    // Mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function request() {
    if (status === "loading") return;
    if (!whatYouDid.trim()) {
      setMissing(true);
      whatYouDidRef.current?.focus();
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");
    setError(null);
    setSentFrom(JSON.stringify(project));
    const body: ProjectEnhanceRequest = {
      title: project.title.trim(),
      context: project.context.trim(),
      timeframe: project.year.trim(),
      isCurrent: /\b(present|current|ongoing|now)\b/i.test(project.year),
      whatItWas: whatItWas.trim(),
      whatYouDid: whatYouDid.trim(),
      result: result.trim(),
    };
    try {
      const response = await fetch("/api/projects/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => ({}))) as Partial<ProjectEnhanceResponse> & { error?: string; code?: string };
      if (controller.signal.aborted) return;
      if (response.status === 403 && data.code === "FREE_LIMIT_REACHED") {
        setStatus("limit-reached");
      } else if (!response.ok || !data.bullets?.length) {
        setError(data.error ?? "Couldn't write bullets. Please try again.");
        setStatus("form");
      } else {
        setBullets(data.bullets);
        setSelected(new Set(data.bullets.map((_, i) => i)));
        setStatus("ready");
      }
    } catch {
      if (controller.signal.aborted) return;
      setError("Couldn't reach the server. Check your connection and try again.");
      setStatus("form");
    } finally {
      refreshFreeUsage();
    }
  }

  function add() {
    const picked = bullets.filter((_, i) => selected.has(i));
    if (picked.length === 0 || changedSince) return;
    onAdd(picked, replace);
    trackFunnelEvent("project_help_added", { count: picked.length, replaced: replace });
    showToast(
      `${replace ? "Replaced with" : "Added"} ${picked.length} ${picked.length === 1 ? "bullet" : "bullets"}. Use ✦ on a bullet to reword it.`,
      "success"
    );
    onClose();
  }

  function retry() {
    setWhatYouDid(project.bullets.filter((bullet) => bullet.trim()).join("\n"));
    setSentFrom(null);
    setStatus("form");
  }

  const count = selected.size;
  const isDirty = status === "ready" || status === "loading" || Boolean(whatItWas.trim() || result.trim()) || whatYouDid !== project.bullets.filter((b) => b.trim()).join("\n");

  return (
    <CanvasSheet
      title="Write project bullets"
      placement="side"
      subtitle={
        <>
          For <span className="font-medium text-ink">{project.title.trim() || "this project"}</span>. Only what you tell us goes in.
        </>
      }
      isDirty={isDirty}
      onDismiss={() => {
        trackFunnelEvent("project_help_dismissed", { hadBullets: status === "ready" });
        onClose();
      }}
      footer={(requestClose) =>
        status === "ready" ? (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={requestClose}>
              Cancel
            </Button>
            {changedSince ? (
              <Button type="button" size="sm" onClick={retry}>Try again</Button>
            ) : <Button type="button" size="sm" disabled={count === 0} onClick={add}>
              {count === 0 ? "Tick a bullet to add" : `Add ${count} ${count === 1 ? "bullet" : "bullets"}`}
            </Button>}
          </>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={requestClose}>
            Cancel
          </Button>
        )
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
        {status === "form" && (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void request();
            }}
          >
            <Input label="What was it? (optional)" placeholder="e.g. A fundraiser for the local food bank" value={whatItWas} onChange={(e) => setWhatItWas(e.target.value)} />
            <Textarea
              ref={whatYouDidRef}
              autoFocus
              label="What did you do?"
              rows={4}
              placeholder="e.g. Organised volunteers, made the posters in Canva"
              value={whatYouDid}
              onChange={(e) => {
                setWhatYouDid(e.target.value);
                setMissing(false);
              }}
              error={missing ? "Tell us what you did first." : undefined}
            />
            <Input label="What happened? (optional)" placeholder="e.g. We raised enough to fill the pantry for a month" value={result} onChange={(e) => setResult(e.target.value)} />
            {error && (
              <p role="alert" className="text-sm font-medium text-critical">
                {error}
              </p>
            )}
            <div>
              <Button type="submit" size="sm">
                <SparklesIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Write bullets
                <FreeUsesLeft feature="project-enhance" />
              </Button>
            </div>
          </form>
        )}

        {status === "loading" && (
          <div className="flex flex-col gap-2" aria-busy="true">
            <p className="text-sm text-ink-secondary" role="status">
              Writing bullets from your answers…
            </p>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        )}

        {status === "ready" && (
          <div className="flex flex-col gap-2" role="group" aria-label="Suggested bullets">
            {changedSince && <p role="alert" className="text-sm text-ink-secondary">Your project changed since you asked. Try again using your latest details.</p>}
            {bullets.map((text, i) => {
              const checked = selected.has(i);
              return (
                <label
                  key={i}
                  className={clsx(
                    "flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 text-sm leading-snug text-ink transition-colors",
                    checked ? "border-accent bg-accent-soft/40" : "border-border hover:border-border-strong"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-border-strong accent-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  />
                  <span className="min-w-0 flex-1">{text}</span>
                </label>
              );
            })}
            {hadBullets && (
              <Checkbox
                id="project-help-replace"
                label="Replace this project's current bullets"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
              />
            )}
          </div>
        )}

        {status === "limit-reached" && (
          <LimitReachedInline
            title="You've used your free project help"
            message="Upgrade for unlimited help with project bullets. You can still write bullets yourself on the page."
          />
        )}
      </div>
    </CanvasSheet>
  );
}
