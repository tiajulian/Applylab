"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import { getHideQuestionTextPreference } from "@/lib/interview/questionDisplayPreference";
import type { InterviewStageType } from "@/types";
import { Volume2Icon, HeadphonesIcon } from "@/components/ui/icons/LucideIcons";

export interface QuestionCardProps {
  questionText: string;
  questionType: string;
  /** A line under the interviewer's name, e.g. "Practice question · not scored". Live questions
   *  leave it out: the session top bar already shows "Question 3 of 8". */
  progressLabel?: string;
  stageType: InterviewStageType;
  isFollowup?: boolean;
  /** When present, audio is fetched from the cached Cloud TTS endpoint first; falls back to the
   *  browser's speechSynthesis (below) if that request fails for any reason. */
  turnId?: string;
}

/**
 * The browser's default SpeechSynthesis voice is often the flattest-sounding one installed.
 * Scores available English voices and picks the most natural-sounding one instead - "Natural"
 * (Edge/Windows neural voices) and "Google" (Chrome's own voices) are both meaningfully better
 * than a generic offline voice. Falls back to the browser default (returns null) if nothing
 * scores above zero, so this never breaks speech on a browser with only basic voices installed.
 */
function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (english.length === 0) return null;

  function score(v: SpeechSynthesisVoice): number {
    let s = 0;
    if (/natural/i.test(v.name)) s += 100;
    if (/google/i.test(v.name)) s += 50;
    const lang = v.lang.toLowerCase();
    if (lang === "en-au") s += 20;
    else if (lang === "en-gb") s += 10;
    else if (lang === "en-us") s += 5;
    if (!v.localService) s += 5;
    return s;
  }

  const best = [...english].sort((a, b) => score(b) - score(a))[0];
  return score(best) > 0 ? best : null;
}

interface SpeechChunk {
  text: string;
  pauseMs: number;
}

/**
 * SpeechSynthesis reads a whole sentence as one flat run, which is the other big source of
 * robotic-sounding output (on top of voice choice). Splitting on clause/sentence punctuation and
 * inserting a real pause between chunks mimics the micro-pauses a human speaker takes at commas
 * and sentence breaks, since the browser doesn't reliably honor pause length from punctuation alone.
 */
function splitIntoClauses(text: string): SpeechChunk[] {
  const parts = text.split(/([,;:]|[.!?]+)\s+/).filter(Boolean);
  const chunks: SpeechChunk[] = [];
  let buffer = "";

  for (const part of parts) {
    if (/^[,;:.!?]+$/.test(part)) {
      buffer += part;
      chunks.push({ text: buffer.trim(), pauseMs: /[.!?]/.test(part) ? 260 : 130 });
      buffer = "";
    } else {
      buffer += part;
    }
  }
  if (buffer.trim()) chunks.push({ text: buffer.trim(), pauseMs: 0 });

  return chunks.length > 0 ? chunks : [{ text, pauseMs: 0 }];
}


export function QuestionCard({
  questionText,
  questionType,
  progressLabel,
  stageType,
  isFollowup = false,
  turnId,
}: QuestionCardProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showCaptions, setShowCaptions] = useState(() => !getHideQuestionTextPreference());
  const [preferredVoice, setPreferredVoice] = useState<SpeechSynthesisVoice | null>(null);
  // Bumped on every cancel/replay so stale chained-chunk timeouts (or an in-flight cloud-audio
  // fetch) from a previous speakQuestion() call know to stop instead of talking over the new one.
  const speechSessionRef = useRef(0);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  // Mirrors isPlayingAudio for speakQuestion to read without depending on the state itself - see
  // the comment on speakQuestion's deps below for why that distinction matters.
  const isPlayingRef = useRef(false);
  function setPlaying(playing: boolean) {
    isPlayingRef.current = playing;
    setIsPlayingAudio(playing);
  }

  // Extract persona from question text if present (e.g. "[Hiring Manager (Sarah)] ...")
  const personaMatch = questionText.match(/^\[(.*?)\]\s*(.*)$/);
  const persona = personaMatch ? personaMatch[1] : null;
  const cleanQuestion = personaMatch ? personaMatch[2] : questionText;

  // Re-applies the saved audio-only preference on every new question, so revealing the text for
  // one question (via the manual toggle below) doesn't leak into the next - each question stays
  // a fresh "listen first" moment, same as a real interview.
  useEffect(() => {
    setShowCaptions(!getHideQuestionTextPreference());
  }, [questionText]);

  // Voice list loads async in Chrome (fires "voiceschanged" once ready) but is often already
  // populated synchronously in Safari/Firefox - checking both covers either case.
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    function loadVoices() {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) setPreferredVoice(pickBestVoice(voices));
    }

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const stopSpeaking = useCallback(() => {
    speechSessionRef.current += 1;
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = "";
      audioElRef.current = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setPlaying(false);
  }, []);

  // Speaks one clause at a time so a pause can be inserted between them - a single long
  // utterance reads as flat/monotone even with a good voice selected.
  const speakChunks = useCallback((chunks: SpeechChunk[], pitch: number, sessionId: number) => {
    if (chunks.length === 0 || sessionId !== speechSessionRef.current) {
      if (sessionId === speechSessionRef.current) setPlaying(false);
      return;
    }

    const [current, ...rest] = chunks;
    const utterance = new SpeechSynthesisUtterance(current.text);
    utterance.rate = 0.95; // Natural conversational pace
    utterance.pitch = pitch;
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onend = () => {
      if (sessionId !== speechSessionRef.current) return;
      if (rest.length === 0) {
        setPlaying(false);
        return;
      }
      pendingTimeoutRef.current = setTimeout(
        () => speakChunks(rest, pitch, sessionId),
        current.pauseMs
      );
    };
    utterance.onerror = () => {
      if (sessionId === speechSessionRef.current) setPlaying(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [preferredVoice]);

  // Falls back to the browser's speechSynthesis - used when there's no turnId to fetch cloud
  // audio for, or when that fetch/playback fails for any reason (network blip, TTS outage, a
  // future API change on Google's end - see supabase/migrations/20260901000000_interview_audio_cache.sql).
  const speakWithBrowserVoice = useCallback((sessionId: number) => {
    if (sessionId !== speechSessionRef.current) return;
    if (!("speechSynthesis" in window)) {
      setPlaying(false);
      return;
    }
    // Small per-question pitch variation so consecutive questions don't sound identically
    // toned - a flat, unchanging pitch across a whole interview is a giveaway of synthetic speech.
    const pitch = 0.95 + Math.random() * 0.1;
    speakChunks(splitIntoClauses(cleanQuestion), pitch, sessionId);
  }, [cleanQuestion, speakChunks]);

  // Plays the cached Cloud TTS audio for this turn (generating it server-side on first listen),
  // falling back to speakWithBrowserVoice if the fetch or playback fails.
  //
  // Reads isPlayingRef rather than the isPlayingAudio state, and deliberately leaves it out of
  // this callback's deps: this function itself calls setPlaying(), so if it depended on the state
  // it sets, useCallback would hand back a new function identity on every play/stop toggle - which
  // would retrigger the mount effect below (it depends on speakQuestion), which calls stopSpeaking()
  // as its cleanup, which cancels the very playback that was just started, forever. Confirmed this
  // was happening: with the state in the deps, the effect fired thousands of times a second and
  // audio never got a chance to start.
  const speakQuestion = useCallback(async () => {
    if (isPlayingRef.current) {
      stopSpeaking();
      return;
    }

    speechSessionRef.current += 1;
    const sessionId = speechSessionRef.current;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setPlaying(true);

    if (turnId) {
      try {
        const res = await fetch(`/api/interview/turns/${turnId}/audio`);
        if (sessionId !== speechSessionRef.current) return; // superseded while fetching
        if (res.ok) {
          const { audioUrl } = (await res.json()) as { audioUrl?: string };
          if (audioUrl) {
            const audio = new Audio(audioUrl);
            audioElRef.current = audio;
            audio.onended = () => {
              if (sessionId === speechSessionRef.current) setPlaying(false);
            };
            audio.onerror = () => {
              if (sessionId !== speechSessionRef.current) return;
              audioElRef.current = null;
              speakWithBrowserVoice(sessionId);
            };
            await audio.play();
            return;
          }
        }
      } catch {
        if (sessionId !== speechSessionRef.current) return; // superseded while fetching
        // network/API failure - fall through to browser voice below
      }
    }

    speakWithBrowserVoice(sessionId);
  }, [turnId, stopSpeaking, speakWithBrowserVoice]);

  useEffect(() => {
    // Autoplay spoken question when card appears
    speakQuestion();
    return () => stopSpeaking();
  }, [speakQuestion, stopSpeaking]);

  const interviewer = persona || (stageType === "async_video" ? "Recorded question" : "Interviewer");
  const initial = interviewer.trim().charAt(0).toUpperCase() || "I";

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-6">
      {/* Who is asking */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-base font-semibold text-accent"
          >
            {initial}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-ink">{interviewer}</span>
            {progressLabel && <span className="text-xs text-ink-muted">{progressLabel}</span>}
          </div>
          {isFollowup && <Badge variant="accent">Follow-up</Badge>}
          {questionType === "gap" && <Badge variant="attention">Honest gap question</Badge>}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={speakQuestion}
            aria-label={isPlayingAudio ? "Stop reading the question" : "Replay question"}
            className="flex h-9 items-center gap-1.5 rounded-pill px-3 text-xs font-medium text-ink-secondary transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {isPlayingAudio ? <span className="h-3 w-3 rounded-sm bg-ink" /> : <Volume2Icon className="h-4 w-4" />}
            <span aria-hidden="true">{isPlayingAudio ? "Stop" : "Replay"}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCaptions((prev) => !prev)}
            aria-pressed={showCaptions}
            className="rounded px-2 py-1 text-xs font-medium text-ink-secondary underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {showCaptions ? "Hide captions" : "Show captions"}
          </button>
        </div>
      </div>

      {/* Main Question Text */}
      {showCaptions ? (
        <h2 className="mt-5 font-display text-[20px] font-semibold leading-snug text-ink sm:text-[26px]">
          {cleanQuestion}
        </h2>
      ) : (
        <div className="mt-5 rounded border border-dashed border-border bg-paper p-6 text-center text-sm text-ink-muted">
          <HeadphonesIcon className="mr-1.5 inline h-4 w-4 align-text-bottom" /> Listen to the question, or choose Show captions to read it.
        </div>
      )}
    </div>
  );
}
