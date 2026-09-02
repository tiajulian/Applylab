"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { clsx } from "@/lib/utils";

export interface VoiceRecorderProps {
  onAnswerSubmit: (answer: {
    audioBase64?: string;
    mimeType?: string;
    durationSec?: number;
    textAnswer?: string;
  }) => Promise<void>;
  isLoading: boolean;
  disabled?: boolean;
  /** Coding-stage answers are code, not spoken STAR narrative - swaps the textarea to a
   *  monospace font and a code-appropriate placeholder. Voice mode is unaffected; talking
   *  through a solution out loud still works the same way. */
  isCoding?: boolean;
}

export function VoiceRecorder({ onAnswerSubmit, isLoading, disabled, isCoding }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<"idle" | "granted" | "denied">("idle");
  const [micLevel, setMicLevel] = useState(0);
  const [mode, setMode] = useState<"voice" | "text">(isCoding ? "text" : "voice");
  const [textAnswer, setTextAnswer] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up streams & audio context on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const updateMicLevel = useCallback(() => {
    if (!analyserRef.current || !isRecording) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    // Map to 0-100 range with sensitivity boost
    setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
    animFrameRef.current = requestAnimationFrame(updateMicLevel);
  }, [isRecording]);

  async function startRecording() {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      setPermissionState("granted");

      // Setup audio analysis for live waveform visualization
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      // Setup MediaRecorder
      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const fullBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(fullBlob);
        const url = URL.createObjectURL(fullBlob);
        setAudioUrl(url);

        // Stop stream tracks
        stream.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(() => {});
        }
      };

      recorder.start(250); // collect 250ms chunks
      setIsRecording(true);
      setRecordingDuration(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      animFrameRef.current = requestAnimationFrame(updateMicLevel);
    } catch (err: any) {
      console.error("Microphone access error", err);
      setPermissionState("denied");
      setErrorMsg(
        err.name === "NotAllowedError"
          ? "Microphone access was denied. You can enable mic access in browser settings or use the text fallback below."
          : "Unable to access microphone. Please check your audio settings or type your answer."
      );
    }
  }

  function stopRecording() {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setMicLevel(0);
  }

  function resetAudio() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingDuration(0);
    setErrorMsg(null);
  }

  async function handleSubmit() {
    if (mode === "text") {
      if (!textAnswer.trim()) return;
      await onAnswerSubmit({ textAnswer: textAnswer.trim() });
      setTextAnswer("");
      return;
    }

    if (!audioBlob) return;

    // Convert audio blob to base64
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const resultStr = reader.result as string;
      const base64Data = resultStr.split(",")[1];
      const mimeType = audioBlob.type || "audio/webm";

      await onAnswerSubmit({
        audioBase64: base64Data,
        mimeType,
        durationSec: recordingDuration,
      });

      resetAudio();
    };
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      {/* Mode Selector */}
      <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <span className="text-sm font-medium text-ink">Answer Method</span>
        <div className="inline-flex rounded-pill bg-paper-deep p-1">
          <button
            type="button"
            onClick={() => setMode("voice")}
            className={clsx(
              "flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium transition-colors",
              mode === "voice"
                ? "bg-surface text-ink shadow-sm"
                : "text-ink-secondary hover:text-ink"
            )}
          >
            <span>🎙️ Spoken Voice</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("text")}
            className={clsx(
              "flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium transition-colors",
              mode === "text"
                ? "bg-surface text-ink shadow-sm"
                : "text-ink-secondary hover:text-ink"
            )}
          >
            <span>⌨️ Type Answer</span>
          </button>
        </div>
      </div>

      {/* Voice Mode */}
      {mode === "voice" && (
        <div className="flex flex-col items-center gap-4 text-center">
          {/* Recording Timer & Visualizer */}
          <div className="flex flex-col items-center gap-2">
            <div className="font-mono text-2xl font-semibold text-ink">
              {formatTimer(recordingDuration)}
            </div>
            <div className="text-xs text-ink-muted">Target: ~1:30-2:00 mins (STAR format)</div>

            {/* Audio waveform meter */}
            {isRecording && (
              <div className="mt-2 flex h-8 items-center gap-1">
                {[...Array(12)].map((_, i) => {
                  const height = Math.max(
                    4,
                    Math.min(32, (micLevel * (0.5 + (i % 5) * 0.15)))
                  );
                  return (
                    <span
                      key={i}
                      style={{ height: `${height}px` }}
                      className="w-1.5 rounded-pill bg-accent transition-all duration-75"
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Recorded Audio Preview */}
          {audioUrl && !isRecording && (
            <div className="w-full max-w-md rounded border border-border bg-paper p-3">
              <audio controls src={audioUrl} className="w-full" />
            </div>
          )}

          {/* Error Notice */}
          {errorMsg && (
            <div className="rounded bg-critical-soft px-3 py-2 text-xs text-critical">
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {!isRecording && !audioBlob && (
              <Button
                variant="primary"
                onClick={startRecording}
                disabled={disabled || isLoading}
                className="gap-2"
              >
                <span className="h-3 w-3 rounded-full bg-critical animate-pulse" />
                Start Recording Answer
              </Button>
            )}

            {isRecording && (
              <Button
                variant="primary"
                onClick={stopRecording}
                className="bg-critical hover:bg-critical text-white gap-2"
              >
                <span className="h-3 w-3 rounded-sm bg-white" />
                Done Speaking
              </Button>
            )}

            {audioBlob && !isRecording && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={resetAudio}
                  disabled={isLoading}
                >
                  Re-record
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  isLoading={isLoading}
                  disabled={disabled}
                >
                  Submit & Score Answer
                </Button>
              </>
            )}
          </div>

          <p className="mt-2 text-xs text-ink-muted">
            🔒 Audio is processed by Gemini in real-time and immediately discarded. Never stored.
          </p>
        </div>
      )}

      {/* Text Mode Fallback */}
      {mode === "text" && (
        <div className="flex flex-col gap-4">
          <textarea
            rows={isCoding ? 12 : 5}
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            disabled={disabled || isLoading}
            placeholder={
              isCoding
                ? "Write your solution here (code or clear pseudocode). Add a line on time/space complexity if you can."
                : "Type your STAR response here (Situation, Task, Action, Result)..."
            }
            spellCheck={!isCoding}
            className={clsx(
              "w-full rounded border border-border bg-paper p-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
              isCoding && "font-mono"
            )}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted">
              {textAnswer.trim().split(/\s+/).filter(Boolean).length} words
            </span>
            <Button
              variant="primary"
              onClick={handleSubmit}
              isLoading={isLoading}
              disabled={disabled || !textAnswer.trim()}
            >
              Submit & Score Answer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
