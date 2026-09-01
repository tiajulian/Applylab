"use client";

import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { InterviewStageType } from "@/types";

export interface QuestionCardProps {
  questionText: string;
  questionType: string;
  orderIndex: number;
  totalQuestions: number;
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

const STAGE_LABELS: Record<InterviewStageType, { label: string; badge: string }> = {
  phone_screen: { label: "Phone Screen", badge: "Simulated" },
  technical: { label: "Technical & Practical", badge: "Simulated" },
  panel: { label: "Panel Interview", badge: "Multi-Persona" },
  async_video: { label: "Async Video", badge: "One-Way" },
  group: { label: "Group Assessment", badge: "Coached" },
  general: { label: "Behavioural", badge: "Simulated" },
};

export function QuestionCard({
  questionText,
  questionType,
  orderIndex,
  totalQuestions,
  stageType,
  isFollowup = false,
  turnId,
}: QuestionCardProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [preferredVoice, setPreferredVoice] = useState<SpeechSynthesisVoice | null>(null);
  // Bumped on every cancel/replay so stale chained-chunk timeouts (or an in-flight cloud-audio
  // fetch) from a previous speakQuestion() call know to stop instead of talking over the new one.
  const speechSessionRef = useRef(0);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Extract persona from question text if present (e.g. "[Hiring Manager (Sarah)] ...")
  const personaMatch = questionText.match(/^\[(.*?)\]\s*(.*)$/);
  const persona = personaMatch ? personaMatch[1] : null;
  const cleanQuestion = personaMatch ? personaMatch[2] : questionText;

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

  function stopSpeaking() {
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
    setIsPlayingAudio(false);
  }

  // Speaks one clause at a time so a pause can be inserted between them - a single long
  // utterance reads as flat/monotone even with a good voice selected.
  function speakChunks(chunks: SpeechChunk[], pitch: number, sessionId: number) {
    if (chunks.length === 0 || sessionId !== speechSessionRef.current) {
      if (sessionId === speechSessionRef.current) setIsPlayingAudio(false);
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
        setIsPlayingAudio(false);
        return;
      }
      pendingTimeoutRef.current = setTimeout(
        () => speakChunks(rest, pitch, sessionId),
        current.pauseMs
      );
    };
    utterance.onerror = () => {
      if (sessionId === speechSessionRef.current) setIsPlayingAudio(false);
    };

    window.speechSynthesis.speak(utterance);
  }

  // Falls back to the browser's speechSynthesis - used when there's no turnId to fetch cloud
  // audio for, or when that fetch/playback fails for any reason (network blip, TTS outage, a
  // future API change on Google's end - see supabase/migrations/20260901000000_interview_audio_cache.sql).
  function speakWithBrowserVoice(sessionId: number) {
    if (sessionId !== speechSessionRef.current) return;
    if (!("speechSynthesis" in window)) {
      setIsPlayingAudio(false);
      return;
    }
    // Small per-question pitch variation so consecutive questions don't sound identically
    // toned - a flat, unchanging pitch across a whole interview is a giveaway of synthetic speech.
    const pitch = 0.95 + Math.random() * 0.1;
    speakChunks(splitIntoClauses(cleanQuestion), pitch, sessionId);
  }

  // Plays the cached Cloud TTS audio for this turn (generating it server-side on first listen),
  // falling back to speakWithBrowserVoice if the fetch or playback fails.
  async function speakQuestion() {
    if (isPlayingAudio) {
      stopSpeaking();
      return;
    }

    speechSessionRef.current += 1;
    const sessionId = speechSessionRef.current;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsPlayingAudio(true);

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
              if (sessionId === speechSessionRef.current) setIsPlayingAudio(false);
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
  }

  useEffect(() => {
    // Autoplay spoken question when card appears
    speakQuestion();
    return () => stopSpeaking();
  }, [questionText, turnId, preferredVoice]);

  const stageInfo = STAGE_LABELS[stageType] || { label: "Interview", badge: "Mock" };

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      {/* Header Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <Badge variant="accent">{stageInfo.label}</Badge>
          <Badge variant="neutral">
            {isFollowup ? "Adaptive Follow-up" : `Question ${orderIndex} of ${totalQuestions}`}
          </Badge>
          {questionType === "gap" && (
            <Badge variant="attention">Honest Gap Rehearsal</Badge>
          )}
        </div>

        {/* Spoken Voice Button & Captions Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={speakQuestion}
            className="gap-1.5 text-xs"
          >
            {isPlayingAudio ? (
              <>
                <span className="h-2 w-2 rounded-full bg-critical animate-ping" />
                Stop Voice
              </>
            ) : (
              <>
                <span>🔊</span> Listen
              </>
            )}
          </Button>
          <button
            type="button"
            onClick={() => setShowCaptions((prev) => !prev)}
            className="text-xs text-ink-muted hover:text-ink underline"
          >
            {showCaptions ? "Hide Text" : "Show Text"}
          </button>
        </div>
      </div>

      {/* Interviewer Persona Tag */}
      {persona && (
        <div className="mt-4 inline-flex items-center gap-2 rounded bg-paper-deep px-3 py-1.5 text-xs font-medium text-ink">
          <span>👤 Interviewer:</span>
          <span className="font-semibold text-accent">{persona}</span>
        </div>
      )}

      {/* Main Question Text */}
      {showCaptions ? (
        <div className="mt-4">
          <h2 className="text-xl font-display font-semibold leading-relaxed text-ink">
            {cleanQuestion}
          </h2>
        </div>
      ) : (
        <div className="mt-6 rounded border border-dashed border-border bg-paper p-6 text-center text-sm text-ink-muted">
          🎧 Spoken prompt active. Click &quot;Show Text&quot; above to view captions.
        </div>
      )}
    </div>
  );
}
