"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { MicConsentCard } from "@/components/interview/MicConsentCard";
import { clsx } from "@/lib/utils";
import { MicIcon, LockIcon, KeyboardIcon, AlertCircleIcon } from "@/components/ui/icons/LucideIcons";
import {
  SOFT_ANSWER_GUIDE_SEC,
  VIDEO_ANSWER_SEC,
  VIDEO_PREP_SEC,
  VIDEO_RETAKES,
  type AnswerMode,
} from "@/lib/interview/setupConstants";
import type { InterviewStageType } from "@/types";

export interface AnswerPayload {
  audioBase64?: string;
  mimeType?: string;
  durationSec?: number;
  textAnswer?: string;
  /** Generated once per answer and reused on "Try again", so a retry whose first attempt actually
   *  landed gets the stored result back instead of a duplicate score. */
  submissionId: string;
}

export type SubmitResult = { ok: true } | { ok: false; error: string };

export interface VoiceRecorderProps {
  onAnswerSubmit: (answer: AnswerPayload) => Promise<SubmitResult>;
  isLoading: boolean;
  disabled?: boolean;
  /** Coding-stage answers are code, not spoken STAR narrative - swaps the textarea to a
   *  monospace font and a code-appropriate placeholder. Voice mode is unaffected; talking
   *  through a solution out loud still works the same way. */
  isCoding?: boolean;
  /** async_video runs like a real one-way screen: prep countdown, a fixed answer window that
   *  stops by itself, and one re-take. */
  stageType: InterviewStageType;
  initialMode: AnswerMode;
  /** sessionStorage key for an unsent typed answer, so a refresh doesn't lose it. Omit for the
   *  unscored practice question. */
  draftKey?: string;
  submitLabel?: string;
  /** Text-button actions shown on the left under the answer box, e.g. "Skip question". */
  secondaryAction?: ReactNode;
  /** First time out loud: show the consent screen before the browser's mic prompt. */
  needsMicConsent?: boolean;
  onMicConsent?: () => void | Promise<void>;
  /** Lets the page show things only at a given moment (story hints during the video prep). */
  onPhaseChange?: (phase: RecorderPhase) => void;
}

export type RecorderPhase = "idle" | "prep" | "recording" | "stopped";

type Phase = RecorderPhase;

const SUBMIT_ERROR_TEXT = "We couldn't send your answer. It's still here.";

/** Named steps while an answer is scored, driven by elapsed time (the request has no progress). */
const SCORING_STEPS = [
  { at: 0, label: "Listening to your answer" },
  { at: 4, label: "Checking your structure" },
  { at: 10, label: "Writing feedback" },
];
const SLOW_SCORING_SEC = 25;

function ScoringStatus({ typed }: { typed: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(id);
  }, []);

  const current = [...SCORING_STEPS].reverse().find((s) => elapsed >= s.at) ?? SCORING_STEPS[0];
  const label = typed && current === SCORING_STEPS[0] ? "Reading your answer" : current.label;
  return (
    <div role="status" aria-live="polite" className="flex w-full flex-col items-center gap-1 rounded-lg bg-paper-deep px-4 py-3 text-center">
      <span className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="h-2 w-2 rounded-full bg-accent motion-safe:animate-pulse" aria-hidden="true" />
        {label}
      </span>
      {elapsed >= SLOW_SCORING_SEC && (
        <span className="text-xs text-ink-secondary">Still working, this one&apos;s taking longer than usual.</span>
      )}
    </div>
  );
}

/** Space toggles recording, except while typing in a field or on a control that uses Space itself. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "AUDIO"].includes(target.tagName);
}

function formatTimer(sec: number) {
  const safe = Math.max(0, sec);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function readDraft(key?: string): string {
  if (!key) return "";
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(key: string | undefined, value: string) {
  if (!key) return;
  try {
    if (value.trim()) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    // Storage disabled - the answer is still in memory, just not across a refresh.
  }
}

/** crypto.randomUUID only exists in secure contexts and newer browsers; getRandomValues is
 *  everywhere, so build the same v4 UUID from it when needed. */
function newSubmissionId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function VoiceRecorder({
  onAnswerSubmit,
  isLoading,
  disabled,
  isCoding,
  stageType,
  initialMode,
  draftKey,
  submitLabel = "Submit answer",
  secondaryAction,
  needsMicConsent = false,
  onMicConsent,
  onPhaseChange,
}: VoiceRecorderProps) {
  const isTimed = stageType === "async_video";
  const { showToast } = useToast();

  const [mode, setMode] = useState<AnswerMode>(isCoding ? "text" : initialMode);
  const [phase, setPhase] = useState<Phase>("idle");
  const [prepLeft, setPrepLeft] = useState(VIDEO_PREP_SEC);
  const [elapsed, setElapsed] = useState(0);
  const [retakesLeft, setRetakesLeft] = useState(VIDEO_RETAKES);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [textAnswer, setTextAnswer] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false);
  const durationRef = useRef(0);
  // The answer exactly as last sent, with its submissionId. Cleared whenever the answer changes,
  // so "Try again" resends the same thing and a new answer gets a new id.
  const pendingRef = useRef<AnswerPayload | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const showConsent = mode === "voice" && needsMicConsent && !consentGiven;
  // Optional mic check before recording: listens for a few seconds and records nothing.
  const [micCheck, setMicCheck] = useState<"none" | "testing" | "heard" | "quiet">("none");
  const micCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;
  useEffect(() => {
    onPhaseChangeRef.current?.(phase);
  }, [phase]);

  // Restore an unsent typed answer after a refresh (client-only, so after mount).
  useEffect(() => {
    const draft = readDraft(draftKey);
    if (draft) {
      setTextAnswer(draft);
      setMode("text");
    }
  }, [draftKey]);

  const releaseMedia = useCallback(() => {
    if (micCheckTimeoutRef.current) clearTimeout(micCheckTimeoutRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
  }, []);

  useEffect(() => releaseMedia, [releaseMedia]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const hasUnsentAnswer =
    phase === "recording" || Boolean(audioBlob) || (mode === "text" && textAnswer.trim().length > 0);

  useEffect(() => {
    if (!hasUnsentAnswer) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsentAnswer]);

  function stopRecording(auto = false) {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setPhase("stopped");
    setMicLevel(0);
    setAnnouncement("Recording stopped");
    if (auto) showToast("Time's up. Your answer is saved.", "accent");
  }

  async function testMicrophone() {
    if (startingRef.current || micCheck === "testing") return;
    setMicError(null);
    setMicCheck("testing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      let peak = 0;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx: AudioContext = new AudioCtx();
        audioContextRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const level = Math.min(100, Math.round((sum / data.length / 128) * 100));
          peak = Math.max(peak, level);
          setMicLevel(level);
          animFrameRef.current = requestAnimationFrame(tick);
        };
        animFrameRef.current = requestAnimationFrame(tick);
      }
      micCheckTimeoutRef.current = setTimeout(() => {
        releaseMedia();
        setMicLevel(0);
        // No analyser (old browser): access worked, which is all we can tell.
        setMicCheck(!AudioCtx || peak >= 8 ? "heard" : "quiet");
      }, 3000);
    } catch (err: any) {
      console.error("Mic test error", err);
      setMicCheck("none");
      setMicError(
        err?.name === "NotAllowedError"
          ? "Microphone blocked. You can allow it in your browser settings, or type your answers."
          : "We couldn't use your microphone. Check your audio settings, or type your answer."
      );
    }
  }

  async function startRecording() {
    if (startingRef.current || showConsent || micCheck === "testing") return;
    startingRef.current = true;
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      // Live level meter
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx: AudioContext = new AudioCtx();
        audioContextRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          setMicLevel(Math.min(100, Math.round((sum / data.length / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(tick);
        };
        animFrameRef.current = requestAnimationFrame(tick);
      }

      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
        else if (MediaRecorder.isTypeSupported("audio/ogg")) mimeType = "audio/ogg";
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const fullBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(fullBlob);
        setAudioUrl(URL.createObjectURL(fullBlob));
        stream.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(() => {});
        }
      };

      recorder.start(250);
      pendingRef.current = null;
      durationRef.current = 0;
      setElapsed(0);
      setPhase("recording");
      setAnnouncement("Recording started");

      // Elapsed time from a timestamp rather than counting ticks, so the 2:00 limit is exact.
      const startedAt = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const sec = Math.floor((Date.now() - startedAt) / 1000);
        const capped = isTimed ? Math.min(sec, VIDEO_ANSWER_SEC) : sec;
        durationRef.current = capped;
        setElapsed(capped);
        if (isTimed && sec >= VIDEO_ANSWER_SEC) stopRecording(true);
      }, 250);
    } catch (err: any) {
      console.error("Microphone access error", err);
      setPhase("idle");
      setMicError(
        err?.name === "NotAllowedError"
          ? "Microphone blocked. You can allow it in your browser settings, or type your answers."
          : "We couldn't use your microphone. Check your audio settings, or type your answer."
      );
    } finally {
      startingRef.current = false;
    }
  }

  // Keeps the prep countdown's auto-start pointing at the current render's startRecording.
  const startRecordingRef = useRef(startRecording);
  startRecordingRef.current = startRecording;

  // Recorded video: the prep countdown starts as soon as the question is on screen.
  useEffect(() => {
    if (isTimed && mode === "voice" && phase === "idle" && !audioBlob && !micError && !showConsent) setPhase("prep");
  }, [isTimed, mode, phase, audioBlob, micError, showConsent]);

  useEffect(() => {
    if (phase !== "prep") return;
    const startedAt = Date.now();
    setPrepLeft(VIDEO_PREP_SEC);
    setAnnouncement(`Get ready. Recording starts in ${VIDEO_PREP_SEC} seconds.`);
    const id = setInterval(() => {
      const left = VIDEO_PREP_SEC - Math.floor((Date.now() - startedAt) / 1000);
      if (left <= 0) {
        clearInterval(id);
        setPrepLeft(0);
        void startRecordingRef.current();
      } else {
        setPrepLeft(left);
      }
    }, 250);
    return () => clearInterval(id);
  }, [phase]);

  // Screen readers hear milestones, not every second.
  const remaining = VIDEO_ANSWER_SEC - elapsed;
  useEffect(() => {
    if (!isTimed || phase !== "recording") return;
    if (remaining === 30) setAnnouncement("30 seconds left");
    else if (remaining === 10) setAnnouncement("10 seconds left");
  }, [isTimed, phase, remaining]);

  function clearAudio() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setElapsed(0);
    durationRef.current = 0;
    pendingRef.current = null;
    setSubmitError(null);
  }

  function handleRedo() {
    clearAudio();
    if (isTimed) {
      setRetakesLeft((n) => n - 1);
      setPhase("prep");
    } else {
      setPhase("idle");
    }
  }

  function switchMode(next: AnswerMode) {
    if (next === mode || phase === "recording") return;
    pendingRef.current = null;
    setSubmitError(null);
    setMode(next);
    if (next === "text" && phase === "prep") setPhase("idle");
  }

  function handleTextChange(value: string) {
    setTextAnswer(value);
    writeDraft(draftKey, value);
    pendingRef.current = null;
  }

  async function buildPayload(): Promise<AnswerPayload | null> {
    const submissionId = newSubmissionId();
    if (mode === "text") {
      const text = textAnswer.trim();
      return text ? { textAnswer: text, submissionId } : null;
    }
    if (!audioBlob) return null;
    return {
      audioBase64: await blobToBase64(audioBlob),
      mimeType: audioBlob.type || "audio/webm",
      durationSec: durationRef.current,
      submissionId,
    };
  }

  async function handleSubmit() {
    setSubmitError(null);
    setIsPreparing(true);
    let payload = pendingRef.current;
    try {
      if (!payload) {
        payload = await buildPayload();
        if (!payload) return;
        pendingRef.current = payload;
      }
    } catch (err) {
      console.error("Failed to read recording", err);
      setSubmitError("We couldn't read your recording. Please record it again.");
      return;
    } finally {
      setIsPreparing(false);
    }

    const result = await onAnswerSubmit(payload);
    if (result.ok) {
      writeDraft(draftKey, "");
      pendingRef.current = null;
      setTextAnswer("");
      clearAudio();
      setPhase("idle");
    } else {
      setSubmitError(result.error);
    }
  }

  async function copyTypedAnswer() {
    try {
      await navigator.clipboard.writeText(textAnswer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked - the text is still in the box to copy by hand.
    }
  }

  // Space starts/stops recording (or skips the prep countdown) when focus isn't in a field.
  const spaceActionRef = useRef<() => void>(() => {});
  spaceActionRef.current = () => {
    if (isLoading || disabled || showConsent) return;
    if (phase === "recording") stopRecording();
    else if (phase === "idle" || phase === "prep") void startRecording();
  };
  useEffect(() => {
    if (mode !== "voice") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || isTypingTarget(e.target)) return;
      e.preventDefault();
      spaceActionRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  // The answer box grows with the answer instead of scrolling inside a fixed height.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [textAnswer, mode]);

  const busy = isLoading || isPreparing;
  const wordCount = textAnswer.trim().split(/\s+/).filter(Boolean).length;
  const overSoftGuide = !isTimed && elapsed >= SOFT_ANSWER_GUIDE_SEC;
  const timerTone = isTimed
    ? remaining <= 10
      ? "critical"
      : remaining <= 30
        ? "attention"
        : "normal"
    : overSoftGuide
      ? "attention"
      : "normal";

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {/* Mode Selector (hidden while asking for consent: that card has its own "type instead") */}
      {!isCoding && !showConsent && (
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <span className="text-sm font-medium text-ink">How you&apos;re answering</span>
          <div role="radiogroup" aria-label="How you're answering" className="inline-flex rounded-pill bg-paper-deep p-1">
            {(["voice", "text"] as AnswerMode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => switchMode(m)}
                disabled={phase === "recording" || busy}
                className={clsx(
                  "flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-secondary hover:text-ink"
                )}
              >
                {m === "voice" ? <MicIcon className="h-4 w-4" /> : <KeyboardIcon className="h-4 w-4" />}
                {m === "voice" ? "Out loud" : "Typed"}
              </button>
            ))}
          </div>
        </div>
      )}

      {showConsent && (
        <MicConsentCard
          onAllow={async () => {
            await onMicConsent?.();
            setConsentGiven(true);
          }}
          onType={() => switchMode("text")}
        />
      )}

      {/* Voice Mode */}
      {mode === "voice" && !showConsent && (
        <div className="flex flex-col items-center gap-4 text-center">
          {phase === "prep" ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-medium text-ink">Get ready. Recording starts in</p>
              <div className="font-mono text-4xl font-semibold tabular-nums text-ink">{formatTimer(prepLeft)}</div>
              <Button variant="primary" onClick={() => void startRecording()} disabled={disabled}>
                Start now
              </Button>
            </div>
          ) : (
            <div className="flex w-full flex-col items-center gap-2">
              {phase === "recording" && (
                <span className="flex items-center gap-1.5 rounded-pill bg-critical-soft px-2.5 py-0.5 text-xs font-semibold text-critical">
                  <span className="h-2 w-2 rounded-full bg-critical motion-safe:animate-pulse" aria-hidden="true" />
                  Recording
                </span>
              )}
              <div
                className={clsx(
                  "font-mono text-2xl font-semibold tabular-nums",
                  timerTone === "critical" ? "text-critical" : timerTone === "attention" ? "text-attention" : "text-ink"
                )}
              >
                {isTimed ? formatTimer(remaining) : formatTimer(elapsed)}
              </div>
              {isTimed ? (
                <>
                  <div className="h-1.5 w-full max-w-md overflow-hidden rounded-pill bg-paper-deep" aria-hidden="true">
                    <div
                      className={clsx(
                        "h-full transition-[width] duration-300 motion-reduce:transition-none",
                        timerTone === "critical" ? "bg-critical" : timerTone === "attention" ? "bg-attention" : "bg-accent"
                      )}
                      style={{ width: `${(remaining / VIDEO_ANSWER_SEC) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-ink-muted">You have 2 minutes. Recording stops by itself.</div>
                </>
              ) : (
                <div className={clsx("text-xs", overSoftGuide ? "font-medium text-attention" : "text-ink-muted")}>
                  {overSoftGuide ? "Strong answers usually wrap up in 1 to 2 minutes." : "Aim for 1 to 2 minutes."}
                </div>
              )}

              {(phase === "recording" || micCheck === "testing") && (
                <div className="mt-2 flex h-8 items-center gap-1" aria-hidden="true">
                  {[...Array(12)].map((_, i) => (
                    <span
                      key={i}
                      style={{ height: `${Math.max(4, Math.min(32, micLevel * (0.5 + (i % 5) * 0.15)))}px` }}
                      className="w-1.5 rounded-pill bg-accent transition-all duration-75 motion-reduce:transition-none"
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {audioUrl && phase === "stopped" && (
            <div className={clsx("w-full max-w-md rounded border border-border bg-paper p-3", isLoading && "opacity-60")}>
              <audio controls src={audioUrl} className="w-full" />
            </div>
          )}

          {micError && (
            <div role="alert" className="flex flex-col items-center gap-2 rounded bg-critical-soft px-3 py-2 text-xs text-ink">
              <span>{micError}</span>
              <button type="button" onClick={() => switchMode("text")} className="font-semibold underline">
                Type instead
              </button>
            </div>
          )}

          {isLoading ? (
            <ScoringStatus typed={false} />
          ) : (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {phase === "idle" && (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  disabled={disabled || busy || micCheck === "testing"}
                  aria-label="Start recording"
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-accent text-on-accent shadow-pop transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 disabled:opacity-50 motion-reduce:hover:scale-100"
                >
                  <MicIcon className="h-7 w-7" />
                </button>
                <span className="text-xs text-ink-muted">Start recording (or press Space)</span>
                <span role="status" className="flex items-center gap-1.5 text-xs text-ink-muted">
                  {micCheck === "testing"
                    ? "Say something, we're listening…"
                    : micCheck === "heard"
                      ? "Microphone working."
                      : micCheck === "quiet"
                        ? "We couldn't hear you. Check your mic is on and not muted."
                        : null}
                  {micCheck !== "testing" && (
                    <button
                      type="button"
                      onClick={() => void testMicrophone()}
                      disabled={disabled || busy}
                      className="font-medium text-ink-secondary underline underline-offset-2 hover:text-ink disabled:opacity-50"
                    >
                      {micCheck === "none" ? "Test microphone (optional)" : "Test again"}
                    </button>
                  )}
                </span>
              </div>
            )}

            {phase === "recording" && (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => stopRecording()}
                  aria-label="Stop recording"
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-critical text-white shadow-pop focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-critical/40"
                >
                  <span className="h-6 w-6 rounded-sm bg-white" />
                </button>
                <span className="text-xs text-ink-muted">Stop recording (or press Space)</span>
              </div>
            )}

            {phase === "stopped" && audioBlob && (
              <>
                {(!isTimed || retakesLeft > 0) && (
                  <Button variant="secondary" size="sm" onClick={handleRedo} disabled={busy}>
                    {isTimed ? `Re-take (${retakesLeft} left)` : "Re-record"}
                  </Button>
                )}
                <Button variant="primary" onClick={handleSubmit} isLoading={busy} disabled={disabled}>
                  {submitLabel}
                </Button>
              </>
            )}
          </div>
          )}

          <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-muted">
            <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Your recording is sent to Google to score it, then deleted. We never store your audio.
          </p>
        </div>
      )}

      {/* Text Mode */}
      {mode === "text" && (
        <div className="flex flex-col gap-4">
          <textarea
            ref={textareaRef}
            rows={isCoding ? 12 : 5}
            value={textAnswer}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && textAnswer.trim() && !busy && !disabled) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            disabled={disabled || busy}
            aria-label="Your answer"
            placeholder={
              isCoding
                ? "Write your solution here (code or clear pseudocode). Add a line on time/space complexity if you can."
                : "Type your answer here. Try covering the Situation, your Task, the Action you took and the Result."
            }
            spellCheck={!isCoding}
            className={clsx(
              "max-h-[60vh] min-h-[8rem] w-full resize-none overflow-y-auto rounded border border-border bg-paper p-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
              isCoding && "font-mono",
              isLoading && "opacity-60"
            )}
          />
          {isLoading ? (
            <ScoringStatus typed />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-ink-muted">
                {wordCount} words
                {isTimed && " · Aim for about 250-300 words (2 minutes spoken)"}
                <span className="hidden sm:inline"> · Ctrl+Enter to send</span>
              </span>
              <Button variant="primary" onClick={handleSubmit} isLoading={isPreparing} disabled={disabled || !textAnswer.trim()}>
                {submitLabel}
              </Button>
            </div>
          )}
        </div>
      )}

      {submitError && (
        <div role="alert" className="mt-4 flex flex-col gap-3 rounded-lg border border-critical/30 bg-critical-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm text-ink">
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-critical" />
            <div>
              <p className="font-semibold">{SUBMIT_ERROR_TEXT}</p>
              {submitError !== SUBMIT_ERROR_TEXT && <p className="mt-0.5 text-xs text-ink-secondary">{submitError}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {mode === "text" && (
              <Button variant="ghost" size="sm" onClick={copyTypedAnswer}>
                {copied ? "Copied" : "Copy my typed answer"}
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={busy}>
              Try again
            </Button>
          </div>
        </div>
      )}

      {secondaryAction && !isLoading && phase !== "recording" && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">{secondaryAction}</div>
      )}
    </div>
  );
}
