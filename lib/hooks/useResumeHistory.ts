"use client";

import { useCallback, useReducer, useRef } from "react";
import { AUTOSAVE_DELAY_MS } from "@/lib/hooks/useAutosave";
import { applyResumeCommand } from "@/lib/resume/resumeReducer";
import type { EditorSnapshot, ResumeCommand } from "@/lib/resume/resumeCommands";

const MAX_HISTORY = 50;

interface HistoryState {
  past: EditorSnapshot[];
  present: EditorSnapshot;
  future: EditorSnapshot[];
}

type HistoryAction =
  | { kind: "transient"; command: ResumeCommand }
  | { kind: "commit"; command: ResumeCommand }
  | { kind: "checkpoint"; baseline: EditorSnapshot }
  | { kind: "undo" }
  | { kind: "redo" };

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.kind) {
    case "transient": {
      const next = applyResumeCommand(state.present, action.command);
      return next === state.present ? state : { ...state, present: next };
    }
    case "commit": {
      const next = applyResumeCommand(state.present, action.command);
      if (next === state.present) return state;
      return { past: [...state.past, state.present].slice(-MAX_HISTORY), present: next, future: [] };
    }
    case "checkpoint": {
      // Records where `past` should have been before the transient burst that already landed in
      // `present` - the burst itself never gets its own entry, only the state before it started.
      if (action.baseline === state.present) return state;
      return { past: [...state.past, action.baseline].slice(-MAX_HISTORY), present: state.present, future: [] };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return { past: [...state.past, state.present], present: next, future: rest };
    }
    default:
      return state;
  }
}

export interface UseResumeHistoryResult {
  resume: EditorSnapshot;
  canUndo: boolean;
  canRedo: boolean;
  /** Per-keystroke updates: applies to the live render immediately, no history entry yet.
   * Checkpointed into `past` on the next field blur or after an idle pause. */
  dispatchTransient: (command: ResumeCommand) => void;
  /** Discrete/structural edits (button clicks, toolbar actions): one call is one undo step. */
  commit: (command: ResumeCommand) => void;
  /** Call on blur of any editable field - flushes a pending transient burst into history now. */
  onFieldBlur: () => void;
  undo: () => void;
  redo: () => void;
}

export function useResumeHistory(initial: EditorSnapshot): UseResumeHistoryResult {
  const [state, dispatch] = useReducer(historyReducer, { past: [], present: initial, future: [] });
  const baselineRef = useRef<EditorSnapshot | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkpointNow = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (baselineRef.current) {
      dispatch({ kind: "checkpoint", baseline: baselineRef.current });
      baselineRef.current = null;
    }
  }, []);

  const dispatchTransient = useCallback(
    (command: ResumeCommand) => {
      if (!baselineRef.current) {
        baselineRef.current = state.present;
      }
      dispatch({ kind: "transient", command });
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(checkpointNow, AUTOSAVE_DELAY_MS);
    },
    // state.present is read only to seed baselineRef the first time a burst starts; every
    // subsequent keystroke in the same burst hits the `if (!baselineRef.current)` guard instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkpointNow, state.present]
  );

  const commit = useCallback(
    (command: ResumeCommand) => {
      checkpointNow();
      dispatch({ kind: "commit", command });
    },
    [checkpointNow]
  );

  const undo = useCallback(() => {
    checkpointNow();
    dispatch({ kind: "undo" });
  }, [checkpointNow]);

  const redo = useCallback(() => {
    checkpointNow();
    dispatch({ kind: "redo" });
  }, [checkpointNow]);

  return {
    resume: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    dispatchTransient,
    commit,
    onFieldBlur: checkpointNow,
    undo,
    redo,
  };
}
