'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogoMark } from '@/components/marketing/LogoMark';

interface AutofillVideoShowcaseProps {
  webmSrc?: string;
  mp4Src?: string;
  posterSrc?: string;
  className?: string;
}

type SimulationStep = 'idle' | 'cursor-moving' | 'clicked' | 'filling' | 'complete';

export function AutofillVideoShowcase({
  webmSrc = '/videos/applylab-workday-autofill.webm',
  mp4Src = '/videos/applylab-workday-autofill.mp4',
  posterSrc = '/images/autofill-demo-poster.webp',
  className = '',
}: AutofillVideoShowcaseProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoAvailable, setVideoAvailable] = useState<boolean | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(true);

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

    const handleCanPlay = () => {
      setVideoAvailable(true);
    };

    const handleError = () => {
      setVideoAvailable(false);
    };

    testVideo.addEventListener('canplaythrough', handleCanPlay, { once: true });
    testVideo.addEventListener('error', handleError, { once: true });

    if (webmSrc && testVideo.canPlayType('video/webm')) {
      testVideo.src = webmSrc;
    } else if (mp4Src && testVideo.canPlayType('video/mp4')) {
      testVideo.src = mp4Src;
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
      { threshold: 0.2 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [videoAvailable, isPlaying]);

  // 12-Second Choreographed Live Motion Loop
  useEffect(() => {
    if (videoAvailable === true) return;
    if (!isIntersecting && !isManualTrigger) return;
    if (!isPlaying) return;

    const timeoutIds: NodeJS.Timeout[] = [];

    const runLoop = () => {
      // 00:00 - 00:01.8: Reset to empty state
      setSimStep('idle');
      setFilledFields([]);

      // 00:01.8: Cursor begins gliding towards autofill pill
      timeoutIds.push(
        setTimeout(() => {
          setSimStep('cursor-moving');
        }, 1800)
      );

      // 00:03.2: Click event with active pulse
      timeoutIds.push(
        setTimeout(() => {
          setSimStep('clicked');
        }, 3200)
      );

      // 00:03.6 - 00:06.5: Staggered Fast Cascade (150ms per field)
      timeoutIds.push(
        setTimeout(() => {
          setSimStep('filling');
          setFilledFields([1]);
        }, 3600)
      );

      timeoutIds.push(
        setTimeout(() => {
          setFilledFields([1, 2]);
        }, 4200)
      );

      timeoutIds.push(
        setTimeout(() => {
          setFilledFields([1, 2, 3]);
        }, 4800)
      );

      timeoutIds.push(
        setTimeout(() => {
          setFilledFields([1, 2, 3, 4]);
        }, 5400)
      );

      // 00:06.8: All checkmarks green + complete pill
      timeoutIds.push(
        setTimeout(() => {
          setSimStep('complete');
        }, 6600)
      );

      // 00:10.5: Seamless restart of loop
      timeoutIds.push(
        setTimeout(() => {
          if (isPlaying) {
            runLoop();
          }
        }, 10500)
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
      setFilledFields([1, 2, 3, 4]);
      setTimeout(() => {
        setSimStep('complete');
        setTimeout(() => {
          setIsManualTrigger(false);
        }, 3500);
      }, 700);
    }, 200);
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
      className={`w-full overflow-hidden rounded-lg border border-border bg-paper-deep shadow-pop transition-all duration-300 hover:shadow-pop-lg ${className}`}
    >
      {/* 1. Fake Browser Bar */}
      <div className="flex items-center justify-between border-b border-border bg-surface/90 px-3 sm:px-4 py-2 backdrop-blur-sm text-xs">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F56]/90" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]/90" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27C93F]/90" />
        </div>

        {/* Browser URL */}
        <div className="flex items-center gap-1.5 rounded-md bg-paper px-2.5 py-0.5 font-mono text-[10px] sm:text-[11px] text-ink-muted border border-border/80 truncate max-w-[200px] xs:max-w-[260px] sm:max-w-[340px]">
          <span className="text-success text-[10px] shrink-0">🔒</span>
          <span className="truncate">canva.wd3.myworkdayjobs.com/apply/R-10492</span>
        </div>

        {/* Controls & Live Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline-block font-semibold text-[10px] text-accent uppercase tracking-wider">
            Live Autofill
          </span>
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-5 w-5 items-center justify-center rounded bg-surface border border-border text-ink-muted hover:text-ink transition-colors text-[10px]"
            title={isPlaying ? 'Pause simulation' : 'Play simulation'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
        </div>
      </div>

      {/* 2. Body: Video Mode or High-Fidelity Interactive Workday Card */}
      {videoAvailable ? (
        /* Video Element */
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-ink">
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
          </video>
        </div>
      ) : (
        /* Workday Application Form Content */
        <div className="relative p-3.5 sm:p-5 space-y-3 select-none overflow-hidden">
          {/* Workday Job Header */}
          <div className="flex items-center justify-between border-b border-border pb-2.5 bg-surface rounded-md p-3 border shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 shrink-0 rounded-md bg-accent-soft text-accent font-display font-bold flex items-center justify-center text-xs">
                C
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-xs sm:text-sm font-bold text-ink truncate">
                  Product Analyst &middot; Sydney NSW
                </h3>
                <p className="text-[10px] text-ink-muted truncate">
                  Canva &middot; Workday Portal &middot; Step 2 of 4
                </p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-1.5 text-[10px]">
              <span className="rounded bg-paper px-2 py-0.5 border border-border text-ink-secondary hidden xs:inline">
                AU Market
              </span>
            </div>
          </div>

          {/* Form Fields Stack */}
          <div className="rounded-lg border border-border bg-surface p-3 sm:p-4 space-y-2.5 shadow-sm">
            {/* Field 1: Mobile Phone */}
            <div>
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-ink-secondary mb-1">
                <span className="uppercase tracking-wider">Mobile Phone (Australia)</span>
                <AnimatePresence mode="wait">
                  {filledFields.includes(1) ? (
                    <motion.span
                      key="f1-filled"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded bg-success-soft px-1.5 py-0.5 text-[9.5px] sm:text-[10px] font-bold text-success border border-success/30 flex items-center gap-1"
                    >
                      <span>✓</span> <span>04xx Formatted</span>
                    </motion.span>
                  ) : (
                    <span className="text-[9.5px] text-ink-muted font-normal">Required</span>
                  )}
                </AnimatePresence>
              </div>
              <div
                className={`rounded border px-2.5 py-1.5 text-xs font-mono transition-colors duration-200 ${
                  filledFields.includes(1)
                    ? 'bg-paper border-border text-ink font-semibold'
                    : 'bg-paper/40 border-border/60 text-ink-muted/50'
                }`}
              >
                {filledFields.includes(1) ? '0412 663 208' : 'e.g. 0412 000 000'}
              </div>
            </div>

            {/* Field 2 & 3: Work Rights & Notice/Salary in 2 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Work Rights */}
              <div>
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-ink-secondary mb-1">
                  <span className="uppercase tracking-wider truncate">AU Work Rights</span>
                  {filledFields.includes(2) && (
                    <span className="rounded bg-success-soft px-1.5 py-0.2 text-[9px] font-bold text-success border border-success/30">
                      ✓ Selected
                    </span>
                  )}
                </div>
                <div
                  className={`rounded border px-2.5 py-1.5 text-[11px] sm:text-xs truncate transition-colors duration-200 ${
                    filledFields.includes(2)
                      ? 'bg-paper border-border text-ink font-medium'
                      : 'bg-paper/40 border-border/60 text-ink-muted/50'
                  }`}
                >
                  {filledFields.includes(2)
                    ? 'Australian Citizen / PR'
                    : 'Select citizenship...'}
                </div>
              </div>

              {/* Notice & Salary */}
              <div>
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-ink-secondary mb-1">
                  <span className="uppercase tracking-wider truncate">Notice &amp; Salary</span>
                  {filledFields.includes(3) && (
                    <span className="rounded bg-success-soft px-1.5 py-0.2 text-[9px] font-bold text-success border border-success/30">
                      ✓ Populated
                    </span>
                  )}
                </div>
                <div
                  className={`rounded border px-2.5 py-1.5 text-[11px] sm:text-xs truncate transition-colors duration-200 ${
                    filledFields.includes(3)
                      ? 'bg-paper border-border text-ink font-medium'
                      : 'bg-paper/40 border-border/60 text-ink-muted/50'
                  }`}
                >
                  {filledFields.includes(3)
                    ? '4 wks notice · $130k AUD'
                    : 'Notice / salary...'}
                </div>
              </div>
            </div>

            {/* Field 4: Tailored Resume PDF */}
            <div>
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-ink-secondary mb-1">
                <span className="uppercase tracking-wider">Attach Resume</span>
                {filledFields.includes(4) && (
                  <span className="rounded bg-success-soft px-1.5 py-0.5 text-[9.5px] sm:text-[10px] font-bold text-success border border-success/30">
                    ✓ Attached
                  </span>
                )}
              </div>
              <div
                className={`flex items-center justify-between rounded border px-2.5 py-1.5 text-xs transition-colors duration-200 ${
                  filledFields.includes(4)
                    ? 'border-success/30 bg-success-soft/30 text-ink'
                    : 'border-border/60 bg-paper/40 text-ink-muted/50 border-dashed'
                }`}
              >
                {filledFields.includes(4) ? (
                  <>
                    <span className="font-mono text-[11px] truncate">
                      📄 priya-nair-analyst-canva.pdf
                    </span>
                    <span className="text-[10px] text-ink-muted shrink-0 ml-2">
                      1 page &middot; 48 KB
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-ink-muted/60 italic">
                    Upload tailored ATS resume PDF...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Floating Dark ApplyLab Co-Pilot Pill */}
          <div className="rounded-pill bg-[#1E293B] text-[#F8FAFC] border border-[#334155] px-3 sm:px-3.5 py-2 sm:py-2.5 shadow-lg flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 shrink-0 min-w-0">
              <span className="font-bold text-accent flex items-center gap-1.5 text-xs shrink-0">
                <LogoMark className="h-4 w-4 shrink-0" />
                <span>ApplyLab</span>
              </span>
              <span className="text-[#94A3B8] border-r border-[#334155] pr-2.5 text-[11px] hidden sm:inline truncate font-mono">
                {simStep === 'complete'
                  ? '⚡ 24 fields filled (1.4s)!'
                  : simStep === 'filling'
                  ? '⚡ Autofilling fields...'
                  : '🟢 24 fields ready'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={handleManualTrigger}
                className={`rounded-pill px-2.5 sm:px-3.5 py-1 text-[11px] sm:text-xs font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  simStep === 'complete'
                    ? 'bg-success text-white'
                    : 'bg-accent hover:bg-accent-hover text-white active:scale-95'
                }`}
              >
                {simStep === 'complete'
                  ? '✓ Ready to Review'
                  : simStep === 'filling'
                  ? 'Filling...'
                  : '⚡ Autofill'}
              </button>
              <button
                type="button"
                onClick={handleManualTrigger}
                className="rounded-pill bg-[#334155] hover:bg-[#475569] active:scale-95 text-[#F8FAFC] px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium transition-all hidden xs:inline"
              >
                📄 Attach PDF
              </button>
            </div>
          </div>

          {/* Smooth Subtle Animated Cursor */}
          <AnimatePresence>
            {(simStep === 'cursor-moving' || simStep === 'clicked') && (
              <motion.div
                initial={{ opacity: 0, x: 120, y: -20 }}
                animate={
                  simStep === 'cursor-moving'
                    ? { opacity: 1, x: 0, y: 0 }
                    : { opacity: 1, x: 0, y: 0, scale: [1, 0.9, 1] }
                }
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeInOut' }}
                className="pointer-events-none absolute right-24 sm:right-32 bottom-3 z-30"
              >
                <svg
                  className="h-5 w-5 text-ink drop-shadow-md"
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
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="absolute -top-1 -left-1 h-6 w-6 rounded-full bg-accent/50"
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 3. Micro-Badges Footer Strip */}
      <div className="border-t border-border bg-surface/50 px-3.5 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-secondary font-medium">
        <div className="flex items-center gap-1.5">
          <span className="text-success font-bold text-xs">✓</span>
          <span>Fills Workday, SEEK &amp; LinkedIn</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-accent font-bold">⚡</span>
          <span>Avg time: <strong>1.4s</strong></span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-ink-muted">
          <span>📄</span>
          <span>Auto-attaches 1-page PDF</span>
        </div>
      </div>
    </div>
  );
}
