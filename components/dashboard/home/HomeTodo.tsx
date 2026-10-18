"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FollowupModal } from "@/components/dashboard/FollowupModal";
import { useToast } from "@/components/ui/Toast";
import { FreeUsesLeft } from "@/components/upgrade/FreeUsesLeft";
import { GOOD_INTERVIEW_FOLLOWUP_DAYS, OUTCOME_RECHECK_DAYS } from "@/lib/dashboard/followupConfig";
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
  well: `We'll remind you to follow up in ${GOOD_INTERVIEW_FOLLOWUP_DAYS} days.`,
  unsure: `We'll check in again in ${OUTCOME_RECHECK_DAYS} days.`,
  no: "We moved it to Closed. Every interview is good practice.",
};

/** POST records how the round went, DELETE undoes it (one database transaction each). */
async function sendResult(item: AttentionItem, method: "POST" | "DELETE", result?: Outcome) {
  const res = await fetch(`/api/applications/${item.applicationId}/interviews/${item.interviewId}/result`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: result ? JSON.stringify({ result }) : undefined,
    // Finish the save even if the user leaves the page straight after tapping.
    keepalive: true,
  });
  if (!res.ok) throw new ResultError(res.status);
}

class ResultError extends Error {
  constructor(readonly status: number) {
    super(`interview result request failed (${status})`);
  }
}

// The banner's "You have n things to do" line and the To do list share one count.
interface TodoState {
  /** Items to show: an answer hides the follow-up (and, for "no", the interview) rows it settles. */
  visibleItems: AttentionItem[];
  count: number;
  setAnswer: (item: AttentionItem, outcome: Outcome | null) => void;
}

const TodoCountContext = createContext<TodoState | null>(null);

export function TodoProvider({ items, children }: { items: AttentionItem[]; children: ReactNode }) {
  const [answerState, setAnswers] = useState<ReadonlyMap<string, { item: AttentionItem; outcome: Outcome }>>(new Map());

  function setAnswer(item: AttentionItem, outcome: Outcome | null) {
    setAnswers((prev) => {
      const next = new Map(prev);
      if (outcome) next.set(item.id, { item, outcome });
      else next.delete(item.id);
      return next;
    });
  }

  // Only answers for rows still in the list count (the list can be refreshed from the server).
  const answers = [...answerState.values()].filter((answer) => items.some((item) => item.id === answer.item.id));
  // "They said no" closes the application, so its other rows go. "Went well" pushes back the
  // follow-up about that same interview.
  const settles = (answer: (typeof answers)[number], item: AttentionItem) =>
    item.id !== answer.item.id &&
    item.applicationId === answer.item.applicationId &&
    (answer.outcome === "no" ||
      (answer.outcome === "well" && item.type === "followup_due" && item.interviewId === answer.item.interviewId));
  const visibleItems = items.filter((item) => !answers.some((answer) => settles(answer, item)));
  const count = visibleItems.length - answers.filter((answer) => visibleItems.includes(answer.item)).length;

  return <TodoCountContext.Provider value={{ visibleItems, count, setAnswer }}>{children}</TodoCountContext.Provider>;
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
  const { setAnswer } = useTodoCount();
  const { showToast } = useToast();
  const router = useRouter();
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
    setAnswer(item, outcome);
  }

  function run(next: Outcome | null, request: () => Promise<void>, revertTo: Outcome | null, error: string) {
    const tap = ++latestTap.current;
    show(next);
    queue.current = queue.current.then(request).catch((reason: unknown) => {
      // Only roll the row back if nothing has been tapped since; a later tap owns the row now.
      if (latestTap.current === tap) show(revertTo);
      if (reason instanceof ResultError && reason.status === 409) {
        // Answered or changed somewhere else (another tab, the Applications page): show what's true now.
        showToast("That interview was already updated, so your list has been refreshed.", "attention");
        router.refresh();
      } else {
        showToast(error, "critical");
      }
    });
  }

  function choose(outcome: Outcome) {
    run(outcome, () => sendResult(item, "POST", outcome), null, "Couldn't save that. Please try again.");
  }

  function undo() {
    if (!saved) return;
    const outcome = saved;
    run(null, () => sendResult(item, "DELETE"), outcome, "Couldn't undo that. Please try again.");
  }

  if (saved) {
    return (
      <div className={`${row} bg-success-soft/50`} role="status">
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

export function TodoSection() {
  const { visibleItems: items, count } = useTodoCount();
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
