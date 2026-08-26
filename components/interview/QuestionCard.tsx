"use client";

import { useState, useEffect } from "react";
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
}: QuestionCardProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [preferredVoice, setPreferredVoice] = useState<SpeechSynthesisVoice | null>(null);

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

  // Speak question via browser SpeechSynthesis
  function speakQuestion() {
    if (!("speechSynthesis" in window)) return;

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanQuestion);
    utterance.rate = 0.95; // Natural conversational pace
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    // Autoplay spoken question when card appears
    if ("speechSynthesis" in window) {
      speakQuestion();
    }
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [questionText, preferredVoice]);

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
