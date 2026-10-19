"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/utils";
import { CheckIcon, MousePointer2Icon } from "@/components/ui/icons/LucideIcons";
import { DEMO_VISIBILITY_EVENT } from "@/components/marketing/useLandingObserver";

const JOB_TITLE = "Venue Manager";
const TASKS = [
  "Rolled out new POS and inventory systems",
  "Trained new staff on opening and closing",
  "Managed weekly rosters and labour costs",
  "Handled supplier orders and stock counts",
];
const OUTCOMES = ["saved time", "cut errors", "made it easier"];
const NUMBER_PROMPTS = ["Time saved", "People", "Speed"];
// The real Speed template is "__% faster"; the number and "onboarding" are typed by the user.
const METRIC_TEMPLATE_REST = "% faster";
const METRIC_NUMBER = "30";
const METRIC_NOTE = " onboarding";
const BEFORE = "Rolled out new POS and inventory systems.";
// Same verb as the task and only the outcome the user gave: the polish never upgrades a claim.
const VERSIONS = [
  "Rolled out a new POS and inventory system, making onboarding 30% faster.",
  "Made onboarding 30% faster by rolling out a new POS and inventory system.",
];
const LONGEST_VERSION = VERSIONS.reduce((a, b) => (b.length > a.length ? b : a));
const RECAP = ["2 real tasks", "1 real number", "3 versions to choose from"];

// Subtitles for the demo, shown about a second before the pointer acts. `progress` is 0-1;
// `step` is 0 before it starts, 1-3 for the step playing and 4 when finished.
const CAPTIONS = [
  { step: 0, tag: "Step 1 of 3", text: "Watch how it works", progress: 0 },
  { step: 1, tag: "Step 1 of 3", text: "Type your job title", progress: 0.06 },
  { step: 1, tag: "Step 1 of 3", text: "ApplyLab suggests common tasks for that job", progress: 0.14 },
  { step: 1, tag: "Step 1 of 3", text: "Tick only the tasks you actually did", progress: 0.26 },
  { step: 2, tag: "Step 2 of 3", text: "What changed because of your work?", progress: 0.44 },
  { step: 2, tag: "Step 2 of 3", text: "Know a number? Fill in the blank. No number is fine too.", progress: 0.58 },
  { step: 3, tag: "Step 3 of 3", text: "AI rewrites your task as a strong resume bullet", progress: 0.74 },
  { step: 3, tag: "Step 3 of 3", text: "Compare versions and pick your favourite", progress: 0.88 },
  { step: 4, tag: "Done", text: "Done. Your real experience, written to stand out.", progress: 1 },
];

type TargetKey = "title" | "suggest" | "task0" | "task1" | "outcome" | "speed" | "metric" | "polish" | "v0" | "v1";

interface DemoState {
  caption: number;
  /** The step panel on screen. Trails the caption by a beat, so people read before it slides. */
  panel: 1 | 2 | 3;
  title: string;
  titleFocus: boolean;
  pressed: "suggest" | "polish" | null;
  loading: boolean;
  tasksShown: number;
  ticked: number;
  highlightedTask: number;
  tool: boolean;
  outcome: boolean;
  speed: boolean;
  /** null: empty field; otherwise the template, with what has been typed into and after its blank. */
  metric: { number: string; note: string } | null;
  metricFocus: boolean;
  before: boolean;
  writing: boolean;
  bullet: string;
  after: boolean;
  versions: boolean;
  version: number;
  recap: boolean;
}

const START: DemoState = {
  caption: 0,
  panel: 1,
  title: "",
  titleFocus: false,
  pressed: null,
  loading: false,
  tasksShown: 0,
  ticked: 0,
  highlightedTask: -1,
  tool: false,
  outcome: false,
  speed: false,
  metric: null,
  metricFocus: false,
  before: false,
  writing: false,
  bullet: "",
  after: false,
  versions: false,
  version: 0,
  recap: false,
};

// What reduced motion, no-JS and the server render show, and where the demo ends.
const FINAL: DemoState = {
  ...START,
  caption: CAPTIONS.length - 1,
  panel: 3,
  title: JOB_TITLE,
  tasksShown: TASKS.length,
  ticked: 2,
  tool: true,
  outcome: true,
  speed: true,
  metric: { number: METRIC_NUMBER, note: METRIC_NOTE },
  before: true,
  bullet: VERSIONS[0],
  after: true,
  versions: true,
  recap: true,
};

class Cancelled extends Error {}

/** One playthrough. Every wait goes through it, so cancelling stops the whole timeline at once. */
function createRun() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectPending: ((reason: Error) => void) | undefined;
  let cancelled = false;
  return {
    sleep(ms: number) {
      return new Promise<void>((resolve, reject) => {
        if (cancelled) return reject(new Cancelled());
        rejectPending = reject;
        timer = setTimeout(resolve, ms);
      });
    },
    cancel() {
      cancelled = true;
      clearTimeout(timer);
      rejectPending?.(new Cancelled());
    },
  };
}

type Run = ReturnType<typeof createRun>;

/**
 * Decorative walkthrough of the stand-out flow: suggested tasks, the impact questions and the AI
 * bullet, driven by a fake pointer. Plays when the landing observer reports it in view, resets if
 * it leaves view before finishing, and shows the final state under reduced motion.
 */
export function StandOutDemo({ replays, onStepChange }: { replays: number; onStepChange: (step: number) => void }) {
  const [state, setState] = useState<DemoState>(FINAL);
  const cardRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLDivElement>(null);
  const targets = useRef<Partial<Record<TargetKey, HTMLElement | null>>>({});
  const replayRef = useRef<(() => void) | null>(null);

  const caption = CAPTIONS[state.caption];
  useEffect(() => onStepChange(caption.step), [caption.step, onStepChange]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let run: Run | null = null;
    let finished = false;
    let lastTarget: TargetKey | null = null;
    let point = { x: 0, y: 0 };
    const patch = (next: Partial<DemoState>) => setState((current) => ({ ...current, ...next }));

    function placeCursor(key: TargetKey) {
      const el = targets.current[key];
      const cursor = cursorRef.current;
      if (!card || !el || !cursor) return;
      const c = card.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      point = { x: b.left - c.left + Math.min(b.width / 2, 48), y: b.top - c.top + b.height / 2 };
      cursor.style.transform = `translate(${point.x}px, ${point.y}px)`;
      lastTarget = key;
    }

    function parkCursor() {
      const cursor = cursorRef.current;
      if (!card || !cursor) return;
      cursor.style.transition = "none";
      cursor.style.opacity = "0";
      cursor.classList.remove("is-click");
      cursor.style.transform = `translate(${card.clientWidth * 0.7}px, ${card.clientHeight * 0.9}px)`;
      void cursor.offsetWidth;
      cursor.style.transition = "";
      lastTarget = null;
    }

    function hideCursor() {
      if (cursorRef.current) cursorRef.current.style.opacity = "0";
    }

    async function move(r: Run, key: TargetKey) {
      if (cursorRef.current) cursorRef.current.style.opacity = "1";
      placeCursor(key);
      await r.sleep(750);
    }

    async function click(r: Run) {
      const cursor = cursorRef.current;
      const ripple = rippleRef.current;
      cursor?.classList.add("is-click");
      if (ripple) {
        ripple.style.transform = `translate(${point.x}px, ${point.y}px)`;
        ripple.classList.remove("is-go");
        void ripple.offsetWidth;
        ripple.classList.add("is-go");
      }
      await r.sleep(140);
      cursor?.classList.remove("is-click");
      await r.sleep(120);
    }

    async function press(r: Run, button: "suggest" | "polish") {
      patch({ pressed: button });
      await click(r);
      patch({ pressed: null });
    }

    async function type(r: Run, text: string, apply: (typed: string) => Partial<DemoState>, ms: number) {
      for (let i = 1; i <= text.length; i++) {
        patch(apply(text.slice(0, i)));
        await r.sleep(ms);
      }
    }

    async function play() {
      run?.cancel();
      const r = createRun();
      run = r;
      finished = false;
      setState(START);
      parkCursor();
      try {
        await r.sleep(900);
        patch({ caption: 1 });
        await move(r, "title");
        await click(r);
        patch({ titleFocus: true });
        await type(r, JOB_TITLE, (title) => ({ title }), 60);
        patch({ titleFocus: false });
        await r.sleep(300);
        patch({ caption: 2 });
        await r.sleep(700);
        await move(r, "suggest");
        await press(r, "suggest");
        patch({ loading: true });
        await r.sleep(1100);
        patch({ loading: false });
        for (let i = 1; i <= TASKS.length; i++) {
          patch({ tasksShown: i });
          await r.sleep(220);
        }
        await r.sleep(400);
        patch({ caption: 3 });
        await r.sleep(900);
        for (const i of [0, 1]) {
          await move(r, i === 0 ? "task0" : "task1");
          patch({ highlightedTask: i });
          await click(r);
          patch({ ticked: i + 1 });
          await r.sleep(200);
          patch({ highlightedTask: -1 });
        }
        patch({ tool: true });
        await r.sleep(500);

        patch({ caption: 4 });
        hideCursor();
        await r.sleep(500);
        patch({ panel: 2 });
        await r.sleep(900);
        await move(r, "outcome");
        await click(r);
        patch({ outcome: true });
        await r.sleep(300);
        patch({ caption: 5 });
        await r.sleep(1300);
        await move(r, "speed");
        await click(r);
        patch({ speed: true });
        await r.sleep(300);
        patch({ metric: { number: "", note: "" } });
        await move(r, "metric");
        await click(r);
        patch({ metricFocus: true });
        await r.sleep(450);
        await type(r, METRIC_NUMBER, (number) => ({ metric: { number, note: "" } }), 200);
        await type(r, METRIC_NOTE, (note) => ({ metric: { number: METRIC_NUMBER, note } }), 50);
        patch({ metricFocus: false });
        await r.sleep(500);

        patch({ caption: 6 });
        hideCursor();
        await r.sleep(500);
        patch({ panel: 3, before: true });
        await r.sleep(900);
        await move(r, "polish");
        await press(r, "polish");
        patch({ writing: true });
        await r.sleep(1300);
        patch({ writing: false, after: true });
        await type(r, VERSIONS[0], (bullet) => ({ bullet }), 24);
        patch({ versions: true });
        await r.sleep(500);
        patch({ caption: 7 });
        await r.sleep(900);
        await move(r, "v1");
        await click(r);
        patch({ version: 1, bullet: VERSIONS[1] });
        await r.sleep(1000);
        await move(r, "v0");
        await click(r);
        patch({ version: 0, bullet: VERSIONS[0] });
        await r.sleep(500);
        hideCursor();
        patch({ caption: CAPTIONS.length - 1, recap: true });
        finished = true;
      } catch (error) {
        if (!(error instanceof Cancelled)) throw error;
      } finally {
        if (run === r) run = null;
      }
    }

    // Left view mid-play: start over next time it is seen.
    function onVisibility(event: Event) {
      const visible = (event as CustomEvent<boolean>).detail;
      if (visible && !run && !finished) void play();
      if (!visible && run) {
        run.cancel();
        run = null;
        setState(START);
        parkCursor();
      }
    }

    function onResize() {
      if (lastTarget) placeCursor(lastTarget);
    }

    card.classList.add("is-instant");
    setState(START);
    parkCursor();
    const settle = requestAnimationFrame(() => requestAnimationFrame(() => card.classList.remove("is-instant")));
    replayRef.current = () => {
      const rect = card.getBoundingClientRect();
      const onScreen = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      if (onScreen < rect.height * 0.35) card.scrollIntoView({ behavior: "smooth", block: "start" });
      void play();
    };
    card.addEventListener(DEMO_VISIBILITY_EVENT, onVisibility);
    window.addEventListener("resize", onResize);
    return () => {
      run?.cancel();
      cancelAnimationFrame(settle);
      replayRef.current = null;
      card.removeEventListener(DEMO_VISIBILITY_EVENT, onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (replays > 0) replayRef.current?.();
  }, [replays]);

  const target = (key: TargetKey) => (el: HTMLElement | null) => {
    targets.current[key] = el;
  };
  const panelClass = (n: DemoState["panel"]) =>
    clsx("so-panel", state.panel === n && "is-show", state.panel > n && "is-past");
  return (
    <>
      <p className="sr-only">
        Example: ApplyLab suggests tasks for a venue manager, helps find a real metric, and writes a polished bullet.
      </p>
      <div ref={cardRef} className="so-card" data-demo aria-hidden="true">
        <div ref={rippleRef} className="so-ripple">
          <i />
        </div>
        <div ref={cursorRef} className="so-cursor">
          <MousePointer2Icon className="so-cursor-icon" />
        </div>

        <div className="so-cap">
          <span className="so-cap-tag">
            {/* The widest label, invisible, so "Done" can't widen the caption and rewrap it. */}
            <span className="so-cap-ghost">Step 3 of 3</span>
            <span>{caption.tag}</span>
          </span>
          <span className="so-cap-text">
            {CAPTIONS.map((c, i) => (
              <span key={c.text} className={clsx(i === state.caption && "is-on")}>
                {c.text}
              </span>
            ))}
          </span>
        </div>
        <div className="so-bar">
          <i style={{ transform: `scaleX(${caption.progress})` }} />
        </div>

        {/* One step at a time: the panels share one grid cell, so the stage is always as tall as the
            tallest panel and the card never changes height. */}
        <div className="so-stage">
          <div className={panelClass(1)}>
            <div className="so-step-head">
              <b>
                <span className="so-step-num">1</span>Pick the tasks you did
              </b>
            </div>
            <div className="so-label">Job title</div>
            <div className="so-top">
              <div ref={target("title")} className={clsx("so-field", state.titleFocus && "is-focus")}>
                <span>{state.title || " "}</span>
                {state.titleFocus && <span className="so-caret" />}
              </div>
              <span ref={target("suggest")} className={clsx("so-pill", state.pressed === "suggest" && "is-press")}>
                Suggest tasks
              </span>
            </div>
            <div className="so-tasks">
              <div className={clsx("so-loading", state.loading && "is-in")}>
                Looking up typical tasks for &ldquo;{JOB_TITLE}&rdquo;&hellip;
              </div>
              {TASKS.map((task, i) => (
                <div
                  key={task}
                  className={clsx("so-task", i < state.tasksShown && "is-in", state.highlightedTask === i && "is-hl")}
                >
                  <span
                    ref={i === 0 ? target("task0") : i === 1 ? target("task1") : undefined}
                    className={clsx("so-box", i < state.ticked && "is-on")}
                  >
                    <CheckIcon className="so-box-tick" />
                  </span>
                  <span className={clsx("so-task-text", i > 1 && "so-soft")}>
                    {task}
                    {i === 0 && <span className={clsx("so-tool so-fade", state.tool && "is-in")}>Square POS</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className={panelClass(2)}>
            <div className="so-step-head">
              <b>
                <span className="so-step-num">2</span>Add what changed
              </b>
            </div>
            <div className="so-q">What changed?</div>
            <div className="so-chips">
              {OUTCOMES.map((outcome, i) => (
                <span
                  key={outcome}
                  ref={i === 0 ? target("outcome") : undefined}
                  className={clsx("so-chip", i === 0 && state.outcome && "is-on")}
                >
                  {outcome}
                </span>
              ))}
            </div>
            <div className="so-q">Know a number? (optional)</div>
            <div className="so-chips">
              {NUMBER_PROMPTS.map((prompt) => (
                <span
                  key={prompt}
                  ref={prompt === "Speed" ? target("speed") : undefined}
                  className={clsx("so-chip", prompt === "Speed" && state.speed && "is-on")}
                >
                  {prompt}
                </span>
              ))}
            </div>
            <div className={clsx("so-q so-fade", state.speed && "is-in")}>Did something get faster?</div>
            <div ref={target("metric")} className={clsx("so-field", state.metricFocus && "is-focus")}>
              {state.metric === null ? (
                " "
              ) : (
                <span>
                  {state.metric.number || <span className="so-blank">__</span>}
                  {METRIC_TEMPLATE_REST}
                  {state.metric.note}
                </span>
              )}
            </div>
            <div className="so-help">Only if it&apos;s true. We never fill one in for you.</div>
          </div>

          <div className={panelClass(3)}>
            <div className="so-step-head">
              <b>
                <span className="so-step-num">3</span>Choose your new bullet
              </b>
              <span ref={target("polish")} className={clsx("so-pill", state.pressed === "polish" && "is-press")}>
                Polish with AI
              </span>
            </div>
            <div className={clsx("so-fade", state.before && "is-in")}>
              <div className="so-tag">Before</div>
              <div className="so-before">{BEFORE}</div>
            </div>
            <div className={clsx("so-tag is-after so-fade", state.after && "is-in")}>After</div>
            <div className="so-out">
              {/* The longest version, invisible, holds the bullet's final height while it types. */}
              <span className="so-out-ghost">{LONGEST_VERSION}</span>
              {state.writing ? <span className="so-writing">Writing 3 versions&hellip;</span> : <span>{state.bullet}</span>}
            </div>
            <div className={clsx("so-chips so-versions so-fade", state.versions && "is-in")}>
              {["Version 1", "Version 2", "Version 3"].map((label, i) => (
                <span
                  key={label}
                  ref={i === 0 ? target("v0") : i === 1 ? target("v1") : undefined}
                  className={clsx("so-chip", state.version === i && "is-on")}
                >
                  {label}
                </span>
              ))}
            </div>
            <div className={clsx("so-recap so-fade", state.recap && "is-in")}>
              {RECAP.map((item) => (
                <span key={item}>
                  <CheckIcon className="h-3.5 w-3.5" /> {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
