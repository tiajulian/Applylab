'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogoMark } from '@/components/marketing/LogoMark';

interface AutofillVideoShowcaseProps {
  webmSrc?: string;
  mp4Src?: string;
  posterSrc?: string;
  interactiveFallback?: boolean;
  className?: string;
}

type SimulationStep = 'idle' | 'cursor-moving' | 'clicked' | 'filling' | 'complete';

export function AutofillVideoShowcase({
  webmSrc = '/videos/applylab-workday-autofill.webm',
  mp4Src = '/videos/applylab-workday-autofill.mp4',
  posterSrc = '/images/autofill-demo-poster.webp',
  interactiveFallback = true,
  className = '',
}: AutofillVideoShowcaseProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoAvailable, setVideoAvailable] = useState<boolean | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  // Live simulation states
  const [simStep, setSimStep] = useState<SimulationStep>('idle');
  const [filledFields, setFilledFields] = useState<number[]>([]);
  const [isManualTrigger, setIsManualTrigger] = useState(false);

  // Check if video file actually exists and loads
  useEffect(() => {
    if (!webmSrc && !mp4Src) {
      setVideoAvailable(false);
      return;
    }

    const testVideo = document.createElement('video');
    let isSupported = false;

    const handleCanPlay = () => {
      setVideoAvailable(true);
    };

    const handleError = () => {
      // If video file is not found (e.g. 404), seamlessly fallback to code motion simulation
      setVideoAvailable(false);
    };

    testVideo.addEventListener('canplaythrough', handleCanPlay, { once: true });
    testVideo.addEventListener('error', handleError, { once: true });

    if (webmSrc && testVideo.canPlayType('video/webm')) {
      testVideo.src = webmSrc;
      isSupported = true;
    } else if (mp4Src && testVideo.canPlayType('video/mp4')) {
      testVideo.src = mp4Src;
      isSupported = true;
    } else {
      setVideoAvailable(false);
    }

    return () => {
      testVideo.removeEventListener('canplaythrough', handleCanPlay);
      testVideo.removeEventListener('error', handleError);
      testVideo.src = '';
    };
  }, [webmSrc, mp4Src]);

  // Performance optimization: IntersectionObserver to pause/resume
  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (videoRef.current && videoAvailable) {
          if (entry.isIntersecting && isPlaying) {
            videoRef.current.play().catch(() => {});
          } else {
            videoRef.current.pause();
          }
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [videoAvailable, isPlaying]);

  // 12-Second Choreographed Live Motion Loop
  useEffect(() => {
    if (videoAvailable === true) return; // If video is rendering, skip simulation loop
    if (!isIntersecting && !isManualTrigger) return;
    if (!isPlaying) return;

    let timeoutIds: NodeJS.Timeout[] = [];

    const runLoop = () => {
      // 00:00 - 00:02: Reset to empty state
      setSimStep('idle');
      setFilledFields([]);

      // 00:02: Cursor begins gliding towards autofill pill
      timeoutIds.push(
        setTimeout(() => {
          setSimStep('cursor-moving');
        }, 1800)
      );

      // 00:03.4: Click event with active pulse
      timeoutIds.push(
        setTimeout(() => {
          setSimStep('clicked');
        }, 3400)
      );

      // 00:04 - 00:07.5: Staggered Fast Cascade (150ms per field)
      timeoutIds.push(
        setTimeout(() => {
          setSimStep('filling');
          // Field 1: AU Mobile
          setFilledFields([1]);
        }, 3800)
      );

      timeoutIds.push(
        setTimeout(() => {
          // Field 2: Work Rights
          setFilledFields([1, 2]);
        }, 4400)
      );

      timeoutIds.push(
        setTimeout(() => {
          // Field 3: Notice Period
          setFilledFields([1, 2, 3]);
        }, 5000)
      );

      timeoutIds.push(
        setTimeout(() => {
          // Field 4: Expected Salary
          setFilledFields([1, 2, 3, 4]);
        }, 5600)
      );

      timeoutIds.push(
        setTimeout(() => {
          // Field 5: Tailored Resume PDF
          setFilledFields([1, 2, 3, 4, 5]);
        }, 6200)
      );

      // 00:08 - 00:10.5: All checkmarks green + success pill
      timeoutIds.push(
        setTimeout(() => {
          setSimStep('complete');
        }, 7600)
      );

      // 00:11.5: Seamless restart of loop
      timeoutIds.push(
        setTimeout(() => {
          if (isPlaying) {
            runLoop();
          }
        }, 11500)
      );
    };

    runLoop();

    return () => {
      timeoutIds.forEach((id) => clearTimeout(id));
    };
  }, [videoAvailable, isIntersecting, isPlaying, isManualTrigger]);

  const handleManualTrigger = () => {
    setIsManualTrigger(true);
    setSimStep('clicked');
    setFilledFields([]);

    setTimeout(() => {
      setSimStep('filling');
      setFilledFields([1, 2, 3, 4, 5]);
      setTimeout(() => {
        setSimStep('complete');
        setTimeout(() => {
          setIsManualTrigger(false);
        }, 4000);
      }, 900);
    }, 250);
  };

  const togglePlay = () => {
    if (videoRef.current && videoAvailable) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative mx-auto w-full max-w-[860px] rounded-2xl border border-border bg-paper-deep p-2 sm:p-3 shadow-pop-lg transition-all duration-300 ${className}`}
    >
      {/* Browser Window Bar */}
      <div className="flex items-center justify-between rounded-t-xl border-b border-border bg-surface/95 px-3.5 sm:px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#FF5F56]/90 transition-transform hover:scale-110" />
          <span className="h-3 w-3 rounded-full bg-[#FFBD2E]/90 transition-transform hover:scale-110" />
          <span className="h-3 w-3 rounded-full bg-[#27C93F]/90 transition-transform hover:scale-110" />
        </div>

        {/* Mock Australian Job Portal URL */}
        <div className="flex items-center gap-1.5 sm:gap-2 rounded-md bg-paper px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-mono text-ink-muted border border-border/70 max-w-[240px] sm:max-w-[340px] truncate">
          <span className="text-success text-xs font-bold shrink-0">🔒</span>
          <span className="truncate">https://canva.wd3.myworkdayjobs.com/apply/R-10492</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-accent uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            <span className="hidden sm:inline">60 FPS &middot;</span> Live
          </span>
        </div>
      </div>

      {/* Frame Body: Video or Live Code Motion Simulation */}
      <div className="relative overflow-hidden rounded-b-xl bg-surface border border-t-0 border-border/80 aspect-[16/10] sm:min-h-[410px] flex flex-col justify-between select-none">
        {videoAvailable ? (
          /* HTML5 Video Source */
          <div className="relative h-full w-full">
            <video
              ref={videoRef}
              poster={posterSrc}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover object-top"
              aria-label="Screen recording showing ApplyLab Chrome extension autofilling a Workday job application in 1 click"
            >
              <source src={webmSrc} type="video/webm" />
              <source src={mp4Src} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        ) : (
          /* High-Fidelity 60fps Code Motion Simulation (Storyboard Scene Execution) */
          <div className="relative h-full w-full p-3 sm:p-5 flex flex-col justify-between bg-gradient-to-b from-surface to-paper-deep/60">
            {/* Header in Workday Application */}
            <div className="border-b border-border pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-accent/15 flex items-center justify-center font-display font-bold text-accent text-xs">
                  C
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-ink leading-tight">
                    Product Analyst &middot; Sydney NSW
                  </h4>
                  <p className="text-[10px] text-ink-muted">Canva Workday Portal &middot; Step 2 of 4</p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-[10px] text-ink-muted">
                <span className="rounded bg-paper px-2 py-0.5 border border-border">AU Market</span>
                <span className="rounded bg-paper px-2 py-0.5 border border-border">ATS Verified</span>
              </div>
            </div>

            {/* Application Input Fields Cascade */}
            <div className="py-2.5 sm:py-3 space-y-2.5 max-w-full overflow-hidden">
              {/* Field 1: AU Mobile */}
              <div className="rounded-lg border border-border/80 bg-paper p-2 sm:p-2.5 transition-all duration-300">
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-ink-secondary mb-1">
                  <span className="uppercase tracking-wider">Mobile Phone (Australia)</span>
                  <AnimatePresence mode="wait">
                    {filledFields.includes(1) ? (
                      <motion.span
                        key="filled-1"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded bg-success-soft px-1.5 py-0.2 text-[9px] sm:text-[10px] font-bold text-success border border-success/30 flex items-center gap-1"
                      >
                        <span>✓</span> <span>04xx Formatted</span>
                      </motion.span>
                    ) : (
                      <span className="text-[9px] text-ink-muted font-normal">Required</span>
                    )}
                  </AnimatePresence>
                </div>
                <div
                  className={`rounded border px-2.5 py-1 sm:py-1.5 text-xs font-mono transition-all duration-300 ${
                    filledFields.includes(1)
                      ? 'bg-success-soft/20 border-success/40 text-ink font-semibold'
                      : 'bg-surface border-border text-ink-muted/50'
                  }`}
                >
                  {filledFields.includes(1) ? '0412 663 208' : 'e.g. 0412 000 000'}
                </div>
              </div>

              {/* Field 2: AU Work Rights & Notice */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Work Rights */}
                <div className="rounded-lg border border-border/80 bg-paper p-2 sm:p-2.5 transition-all duration-300">
                  <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-ink-secondary mb-1">
                    <span className="uppercase tracking-wider truncate">AU Work Rights</span>
                    {filledFields.includes(2) && (
                      <span className="rounded bg-success-soft px-1.5 text-[9px] font-bold text-success border border-success/30">
                        ✓ Selected
                      </span>
                    )}
                  </div>
                  <div
                    className={`rounded border px-2.5 py-1 text-xs truncate transition-all duration-300 ${
                      filledFields.includes(2)
                        ? 'bg-success-soft/20 border-success/40 text-ink font-medium'
                        : 'bg-surface border-border text-ink-muted/50'
                    }`}
                  >
                    {filledFields.includes(2)
                      ? 'Australian Citizen / Permanent Resident'
                      : 'Select work authorisation...'}
                  </div>
                </div>

                {/* Notice & Salary */}
                <div className="rounded-lg border border-border/80 bg-paper p-2 sm:p-2.5 transition-all duration-300">
                  <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-ink-secondary mb-1">
                    <span className="uppercase tracking-wider truncate">Notice &amp; Salary</span>
                    {filledFields.includes(3) && (
                      <span className="rounded bg-success-soft px-1.5 text-[9px] font-bold text-success border border-success/30">
                        ✓ Populated
                      </span>
                    )}
                  </div>
                  <div
                    className={`rounded border px-2.5 py-1 text-xs truncate transition-all duration-300 ${
                      filledFields.includes(3)
                        ? 'bg-success-soft/20 border-success/40 text-ink font-medium'
                        : 'bg-surface border-border text-ink-muted/50'
                    }`}
                  >
                    {filledFields.includes(3)
                      ? '4 weeks notice &middot; $130,000 AUD'
                      : 'Notice period / salary expectations'}
                  </div>
                </div>
              </div>

              {/* Field 3: Resume PDF Attachment */}
              <div className="rounded-lg border border-border/80 bg-paper p-2 sm:p-2.5 transition-all duration-300">
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-ink-secondary mb-1">
                  <span className="uppercase tracking-wider">Tailored Resume Attachment</span>
                  {filledFields.includes(5) && (
                    <span className="rounded bg-success-soft px-1.5 py-0.2 text-[9px] font-bold text-success border border-success/30">
                      ✓ ATS 1-Page PDF
                    </span>
                  )}
                </div>
                <div
                  className={`flex items-center justify-between rounded border px-2.5 py-1.5 text-xs transition-all duration-300 ${
                    filledFields.includes(5)
                      ? 'bg-success-soft/30 border-success/50 text-ink'
                      : 'bg-surface border-border text-ink-muted/50 border-dashed'
                  }`}
                >
                  {filledFields.includes(5) ? (
                    <>
                      <span className="font-mono text-[11px] flex items-center gap-1.5 truncate">
                        <span className="text-accent">📄</span> priya-nair-analyst-canva.pdf
                      </span>
                      <span className="text-[10px] text-ink-muted shrink-0 ml-2">1 page &middot; 48 KB</span>
                    </>
                  ) : (
                    <span className="text-[11px] text-ink-muted italic">Click to upload or drag resume file...</span>
                  )}
                </div>
              </div>
            </div>

            {/* Floating Dark ApplyLab Co-Pilot Pill */}
            <div className="relative z-10 my-1">
              <div
                className={`rounded-full bg-[#0F172A] text-[#F8FAFC] border border-[#334155] px-3 sm:px-4 py-2 shadow-2xl flex items-center justify-between gap-2 transition-all duration-300 ${
                  simStep === 'clicked' ? 'scale-[0.98] ring-2 ring-accent' : 'hover:border-accent/60'
                }`}
              >
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-accent">
                    <LogoMark className="h-4 w-4 shrink-0 text-accent" />
                    <span className="tracking-tight">ApplyLab</span>
                  </div>
                  <span className="text-[#94A3B8] border-l border-[#334155] pl-2 text-[11px] hidden sm:inline font-mono">
                    {simStep === 'complete'
                      ? '✓ 24 of 24 fields completed'
                      : simStep === 'filling'
                      ? '⚡ Cascading 24 fields...'
                      : '🟢 24 fields ready'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleManualTrigger}
                    className={`rounded-full px-3 py-1 text-[11px] sm:text-xs font-bold shadow-md transition-all flex items-center gap-1.5 ${
                      simStep === 'complete'
                        ? 'bg-success text-white'
                        : 'bg-accent hover:bg-accent-hover text-white active:scale-95'
                    }`}
                  >
                    {simStep === 'complete' ? (
                      <>
                        <span>📄</span>
                        <span>Ready to Review</span>
                      </>
                    ) : (
                      <>
                        <span>⚡</span>
                        <span>{simStep === 'filling' ? 'Filling (1.4s)...' : 'Autofill'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleManualTrigger}
                    className="rounded-full bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] px-2.5 py-1 text-[11px] font-medium transition-colors hidden xs:inline"
                  >
                    PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Simulated Animated Cursor */}
            <AnimatePresence>
              {(simStep === 'cursor-moving' || simStep === 'clicked') && (
                <motion.div
                  initial={{ opacity: 0, x: 280, y: 140 }}
                  animate={
                    simStep === 'cursor-moving'
                      ? { opacity: 1, x: 190, y: 195 }
                      : { opacity: 1, x: 190, y: 195, scale: [1, 0.85, 1] }
                  }
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                  className="pointer-events-none absolute right-16 sm:right-28 bottom-7 z-30"
                >
                  <svg
                    className="h-6 w-6 text-ink drop-shadow-md"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="white"
                    strokeWidth="1.5"
                  >
                    <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35Z" />
                  </svg>
                  {simStep === 'clicked' && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0.8 }}
                      animate={{ scale: 2.2, opacity: 0 }}
                      transition={{ duration: 0.5 }}
                      className="absolute -top-1 -left-1 h-8 w-8 rounded-full bg-accent/40"
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Floating Manual Play / Pause / Replay Controls */}
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={togglePlay}
            className="rounded-full bg-black/60 p-1.5 sm:p-2 text-white backdrop-blur-md transition-all hover:bg-black/80 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent shadow-sm"
            aria-label={isPlaying ? 'Pause demo' : 'Play demo'}
            title={isPlaying ? 'Pause demo' : 'Play demo'}
          >
            {isPlaying ? (
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Feature Micro-Badges Beneath the Frame */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-1.5 text-ink-secondary font-medium">
          <span className="text-success font-bold text-sm">✓</span>
          <span>Fills Workday, SEEK, LinkedIn &amp; PageUp</span>
        </div>
        <div className="flex items-center gap-1.5 text-ink-secondary font-medium">
          <span className="text-accent font-bold">⚡</span>
          <span>
            Average fill time: <strong>1.4 seconds</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-ink-secondary font-medium hidden md:flex">
          <span className="text-ink-muted">📄</span>
          <span>Auto-attaches 1-page tailored PDF</span>
        </div>
      </div>
    </div>
  );
}
