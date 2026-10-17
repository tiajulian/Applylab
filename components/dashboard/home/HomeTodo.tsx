"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { FollowupModal } from "@/components/dashboard/FollowupModal";
import { useToast } from "@/components/ui/Toast";
import { FreeUsesLeft } from "@/components/upgrade/FreeUsesLeft";
import type { AttentionItem } from "@/lib/dashboard/attention";
import {
  btnOutline,
  btnText,
  card,
  countBadge,
  iconBlue,
  iconGreen,
  iconOrange,
  row,
  rowBase,
  rowBody,
  rowIcon,
  rowSub,
  rowTitle,
  sectionHead,
  sectionTitle,
} from "@/components/dashboard/home/homeStyles";

type Outcome = "well" | "unsure" | "no";

const OUTCOMES: { value: Outcome; label: string }[] = [
  { value: "well", label: "Went well" },
  { value: "unsure", label: "Not sure yet" },
  { value: "no", label: "They said no" },
];

const OUTCOME_NOTES: Record<Outcome, string> = {
  well: "We'll remind you to follow up in 3 days.",
  unsure: "We'll check in again in 3 days.",
  no: "We moved it to Closed. Every interview is good practice.",
};

async function patchJson(url: string, body: object) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${url} failed (${res.status})`);
}

/**
 * Saves an interview outcome with the routes the Applications page already uses: the round is
 * marked completed, and "They said no" also marks the application not successful (a closed status).
 * TODO(phase 2): "Not sure yet" should snooze the question for 3 days; there's no snooze field yet,
 * so it saves nothing and the question comes back on the next visit.
 */
async function saveOutcome(item: AttentionItem, outcome: Outcome) {
  if (outcome === "unsure") return;
  const roundUrl = `/api/applications/${item.applicationId}/interviews/${item.interviewId}`;
  await patchJson(roundUrl, { outcome: "completed" });
  if (outcome === "no") {
    try {
      await patchJson(`/api/applications/${item.applicationId}`, { status: "rejected" });
    } catch (error) {
      // Don't leave half an outcome saved: put the round back so the question is asked again.
      await patchJson(roundUrl, { outcome: "scheduled" }).catch(() => {});
      throw error;
    }
  }
}

async function undoOutcome(item: AttentionItem, outcome: Outcome) {
  if (outcome === "unsure") return;
  // Mirror of saveOutcome: round first, then status, rolling the round back if the status fails.
  const roundUrl = `/api/applications/${item.applicationId}/interviews/${item.interviewId}`;
  await patchJson(roundUrl, { outcome: "scheduled" });
  if (outcome === "no") {
    try {
      await patchJson(`/api/applications/${item.applicationId}`, { status: item.applicationStatus ?? "interviewing" });
    } catch (error) {
      await patchJson(roundUrl, { outcome: "completed" }).catch(() => {});
      throw error;
    }
  }
}

// The banner's "You have n things to do" line and the To do list share one count.
const TodoCountContext = createContext<{ count: number; setAnswered: (id: string, answered: boolean) => void } | null>(
  null
);

export function TodoProvider({ total, children }: { total: number; children: ReactNode }) {
  const [answered, setAnsweredIds] = useState<ReadonlySet<string>>(new Set());
  function setAnswered(id: string, isAnswered: boolean) {
    setAnsweredIds((prev) => {
      const next = new Set(prev);
      if (isAnswered) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  return (
    <TodoCountContext.Provider value={{ count: total - answered.size, setAnswered }}>{children}</TodoCountContext.Provider>
  );
}

function useTodoCount() {
  const ctx = useContext(TodoCountContext);
  if (!ctx) throw new Error("useTodoCount must be used inside TodoProvider");
  return ctx;
}

export function TodoCountLine() {
  const { count } = useTodoCount();
  return (
    <>{count === 0 ? "You're all caught up this week." : `You have ${count} ${count === 1 ? "thing" : "things"} to do this week.`}</>
  );
}

const PhoneIcon = (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </svg>
);
const EnvelopeIcon = (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16v12H4zM4 7l8 6 8-6" />
  </svg>
);
const ClockIcon = (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" />
  </svg>
);
const CheckIcon = (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

/** Interview check-ins are blue phones; follow-ups and deadlines are orange. */
function ItemIcon({ type }: { type: AttentionItem["type"] }) {
  if (type === "outcome_needed" || type === "upcoming_interview") {
    return <span className={`${rowIcon} ${iconBlue}`}>{PhoneIcon}</span>;
  }
  return <span className={`${rowIcon} ${iconOrange}`}>{type === "closing_soon" ? ClockIcon : EnvelopeIcon}</span>;
}

function OutcomeRow({ item }: { item: AttentionItem }) {
  const { setAnswered } = useTodoCount();
  const { showToast } = useToast();
  const [saved, setSaved] = useState<Outcome | null>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const focusAfter = useRef<"undo" | "choice" | null>(null);
  // Taps update the row at once; the API calls run one after another, so an Undo tapped while
  // the save is still in flight runs after it instead of being lost or racing it.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const latestTap = useRef(0);

  useEffect(() => {
    if (focusAfter.current === "undo") undoRef.current?.focus();
    if (focusAfter.current === "choice") firstChoiceRef.current?.focus();
    focusAfter.current = null;
  }, [saved]);

  function show(outcome: Outcome | null) {
    focusAfter.current = outcome ? "undo" : "choice";
    setSaved(outcome);
    setAnswered(item.id, outcome !== null);
  }

  function run(next: Outcome | null, request: () => Promise<void>, revertTo: Outcome | null, error: string) {
    const tap = ++latestTap.current;
    show(next);
    queue.current = queue.current.then(request).catch(() => {
      // Only roll the row back if nothing has been tapped since; a later tap owns the row now.
      if (latestTap.current === tap) show(revertTo);
      showToast(error, "critical");
    });
  }

  function choose(outcome: Outcome) {
    run(outcome, () => saveOutcome(item, outcome), null, "Couldn't save that. Please try again.");
  }

  function undo() {
    if (!saved) return;
    const outcome = saved;
    run(null, () => undoOutcome(item, outcome), outcome, "Couldn't undo that. Please try again.");
  }

  if (saved) {
    return (
      <div className={`${row} bg-[#F7FDF9]`} role="status">
        <span className={`${rowIcon} ${iconGreen}`}>{CheckIcon}</span>
        <p className={`${rowBody} text-[15px]`}>
          <strong>Saved.</strong> {OUTCOME_NOTES[saved]}
        </p>
        <button ref={undoRef} type="button" className={btnText} onClick={undo}>
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className={`${rowBase} items-start`}>
      <ItemIcon type={item.type} />
      <div className={rowBody}>
        <p className={`${rowTitle} mt-2`}>{item.title}</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Interview outcome">
          {OUTCOMES.map((option, index) => (
            <button
              key={option.value}
              ref={index === 0 ? firstChoiceRef : undefined}
              type="button"
              className={btnOutline}
              onClick={() => choose(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TodoSection({ items }: { items: AttentionItem[] }) {
  const { count } = useTodoCount();
  const [followup, setFollowup] = useState<AttentionItem | null>(null);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="todo-h">
      <div className={sectionHead}>
        <h2 className={sectionTitle} id="todo-h">
          To do {count > 0 && <span className={countBadge}>{count}</span>}
        </h2>
      </div>
      <div className={card}>
        {items.map((item) => {
          if (item.type === "outcome_needed" && item.applicationId && item.interviewId) {
            return <OutcomeRow key={item.id} item={item} />;
          }
          const action = item.actionLabel.replace(/ →$/, "");
          return (
            <div key={item.id} className={row}>
              <ItemIcon type={item.type} />
              <div className={rowBody}>
                <p className={rowTitle}>{item.title}</p>
                {item.subtitle && <p className={rowSub}>{item.subtitle}</p>}
              </div>
              {item.type === "followup_due" && item.applicationId ? (
                <button type="button" className={btnOutline} onClick={() => setFollowup(item)}>
                  Write follow-up
                  <FreeUsesLeft feature="followup-draft" />
                </button>
              ) : item.actionHref ? (
                <Link href={item.actionHref} className={btnOutline}>
                  {action}
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>

      {followup?.applicationId && (
        <FollowupModal
          isOpen
          onClose={() => setFollowup(null)}
          applicationId={followup.applicationId}
          companyName={followup.companyName}
          jobTitle={followup.jobTitle}
        />
      )}
    </section>
  );
}
