"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { GoogleIcon } from "@/components/ui/icons/GoogleIcon";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { ScoreSummaryCard } from "@/components/resume/review/ScoreSummaryCard";
import { CategoryScoreRow } from "@/components/resume/review/CategoryScoreRow";
import { ReviewScoringLoader } from "@/components/resume/review/ReviewScoringLoader";
import { trackFunnelEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { TERMS_VERSION } from "@/lib/terms";
import type { ResumeReviewCategory } from "@/types";

type ScorerState = "input" | "scoring" | "scored" | "error";

interface ScoredData {
  score: number;
  categories: ResumeReviewCategory[];
  totalFindings: number;
  resumeId: string | null;
  contentHash: string;
  candidateName: string | null;
  isAnonymous: boolean;
}

interface PublicResumeScorerProps {
  isLoggedIn?: boolean;
}

export function PublicResumeScorer({ isLoggedIn = false }: PublicResumeScorerProps) {
  const router = useRouter();
  const [state, setState] = useState<ScorerState>("input");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scoredData, setScoredData] = useState<ScoredData | null>(null);

  // Signup Gate State
  const [signupFullName, setSignupFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    trackFunnelEvent("lead_magnet_page_view");
  }, []);

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      validateAndSetFile(dropped);
    }
  }

  function validateAndSetFile(selectedFile: File) {
    setErrorMessage(null);
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      setErrorMessage("Please upload a PDF or Word document (.docx).");
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setErrorMessage("File is too large. Please upload a file under 5 MB.");
      return;
    }
    setFile(selectedFile);
  }

  async function handleScoreSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!turnstileToken) {
      setErrorMessage("Please complete the security verification below.");
      return;
    }

    if (mode === "file" && !file) {
      setErrorMessage("Please select a resume file (PDF or DOCX).");
      return;
    }

    if (mode === "text" && rawText.trim().length < 50) {
      setErrorMessage("Please paste at least 50 characters of resume content.");
      return;
    }

    setState("scoring");
    trackFunnelEvent("lead_magnet_resume_uploaded", {
      fileType: mode === "file" ? file?.name.split(".").pop() : "raw_text",
    });

    try {
      let res: Response;
      if (mode === "file" && file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("turnstileToken", turnstileToken);
        res = await fetch("/api/public/score-resume", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/public/score-resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText, turnstileToken }),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? "Failed to score resume. Please try again.");
        setState("input");
        setCaptchaKey((k) => k + 1);
        setTurnstileToken(null);
        return;
      }

      setScoredData(data);
      setState("scored");

      trackFunnelEvent("lead_magnet_score_rendered", {
        score: data.score,
        findingCount: data.totalFindings,
      });
      if (data.isAnonymous && !isLoggedIn) {
        trackFunnelEvent("lead_magnet_signup_gate_viewed");
      }
    } catch (err) {
      console.error("Score submission failed", err);
      setErrorMessage("A network error occurred. Please check your connection and try again.");
      setState("input");
      setCaptchaKey((k) => k + 1);
      setTurnstileToken(null);
    }
  }

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!agreedToTerms) {
      setSignupError("You must agree to the Terms and Conditions to create an account.");
      return;
    }
    setSignupError(null);
    setIsSigningUp(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          data: {
            full_name: signupFullName || scoredData?.candidateName || "User",
            accepted_terms_version: TERMS_VERSION,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setSignupError(error.message);
        setIsSigningUp(false);
        return;
      }

      trackFunnelEvent("lead_magnet_account_created", {
        source: "email",
        score: scoredData?.score,
      });

      if (scoredData?.resumeId) {
        router.push(`/resume/${scoredData.resumeId}/review`);
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setSignupError("Signup failed. Please try again.");
      setIsSigningUp(false);
    }
  }

  async function handleGoogleSignup() {
    if (!agreedToTerms) {
      setSignupError("You must agree to the Terms and Conditions to continue.");
      return;
    }
    setSignupError(null);
    setIsGoogleLoading(true);

    document.cookie = "pending_terms_accept=1; path=/; max-age=600; SameSite=Lax";

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback${
          scoredData?.resumeId ? `?next=/resume/${scoredData.resumeId}/review` : ""
        }`,
      },
    });

    if (oauthError) {
      setSignupError(oauthError.message);
      setIsGoogleLoading(false);
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <AnimatePresence mode="wait">
        {state === "input" && (
          <motion.div
            key="input-state"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border border-border bg-surface shadow-pop p-6 sm:p-8">
              {/* Mode switch */}
              <div className="flex items-center justify-center gap-2 mb-6 p-1 bg-paper rounded-lg max-w-xs mx-auto border border-border">
                <button
                  type="button"
                  onClick={() => setMode("file")}
                  className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all ${
                    mode === "file"
                      ? "bg-surface text-ink shadow-sm"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Upload File (PDF/DOCX)
                </button>
                <button
                  type="button"
                  onClick={() => setMode("text")}
                  className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all ${
                    mode === "text"
                      ? "bg-surface text-ink shadow-sm"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Paste Text
                </button>
              </div>

              <form onSubmit={handleScoreSubmit} className="space-y-6">
                {mode === "file" ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                      isDragging
                        ? "border-accent bg-accent-soft/30 scale-[0.99]"
                        : file
                        ? "border-accent/40 bg-accent-soft/10"
                        : "border-border hover:border-ink-muted/50 bg-paper/50"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) validateAndSetFile(f);
                      }}
                    />
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-accent-soft text-accent flex items-center justify-center text-xl font-bold">
                        📄
                      </div>
                      {file ? (
                        <div>
                          <p className="font-semibold text-ink text-base">{file.name}</p>
                          <p className="text-xs text-ink-muted mt-0.5">
                            {(file.size / 1024 / 1024).toFixed(2)} MB • Ready to analyze
                          </p>
                          <span className="inline-block mt-2 text-xs font-medium text-accent underline">
                            Change file
                          </span>
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-ink text-base">
                            Drag &amp; drop your resume, or{" "}
                            <span className="text-accent underline">browse</span>
                          </p>
                          <p className="text-xs text-ink-muted mt-1">
                            Supports PDF and Word (.docx) up to 5 MB
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">
                      Paste Your Resume Content
                    </label>
                    <Textarea
                      rows={8}
                      placeholder="Paste your contact info, work experience, skills, and education here..."
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      className="font-mono text-xs leading-relaxed"
                    />
                    <div className="flex justify-between mt-1 text-[11px] text-ink-muted">
                      <span>Minimum 50 characters</span>
                      <span>{rawText.length.toLocaleString()} characters</span>
                    </div>
                  </div>
                )}

                {/* Cloudflare Turnstile Bot Protection */}
                <div className="flex flex-col items-center justify-center gap-2 pt-2">
                  <TurnstileWidget
                    key={captchaKey}
                    onVerify={(token: string) => setTurnstileToken(token)}
                    onError={() => {
                      setTurnstileToken(null);
                      setErrorMessage("Captcha verification failed. Please try again.");
                    }}
                    onExpire={() => setTurnstileToken(null)}
                  />
                </div>

                {errorMessage && (
                  <p className="text-sm font-medium text-critical text-center bg-critical/10 p-2.5 rounded-lg border border-critical/20">
                    {errorMessage}
                  </p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full text-base font-bold shadow-md"
                  disabled={!turnstileToken || (mode === "file" ? !file : rawText.trim().length < 50)}
                >
                  Get Free Resume Score &rarr;
                </Button>
              </form>
            </Card>
          </motion.div>
        )}

        {state === "scoring" && (
          <motion.div
            key="scoring-state"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="py-12"
          >
            <ReviewScoringLoader />
          </motion.div>
        )}

        {state === "scored" && scoredData && (
          <motion.div
            key="scored-state"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {/* Top Score Summary */}
            <ScoreSummaryCard
              score={scoredData.score}
              totalFindings={scoredData.totalFindings}
              isStale={false}
              unlocked={false}
              scoredAt={new Date().toISOString()}
            />

            {/* 5-Category Breakdown */}
            <Card className="border border-border bg-surface p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-display text-lg font-bold text-ink">5-Category Diagnostic Breakdown</h3>
                <span className="text-xs text-ink-muted">100 Points Total</span>
              </div>
              <div className="space-y-3 pt-2">
                {scoredData.categories.map((cat) => (
                  <CategoryScoreRow
                    key={cat.key}
                    category={cat}
                    isSelected={false}
                    onClick={() => {}}
                  />
                ))}
              </div>
            </Card>

            {/* Free Signup Gate for visitors OR Saved Confirmation for logged-in users */}
            {isLoggedIn || !scoredData.isAnonymous ? (
              <Card className="border-2 border-accent/40 bg-surface p-6 sm:p-8 relative overflow-hidden shadow-pop">
                <div className="max-w-xl mx-auto text-center space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-soft text-accent text-xs font-bold">
                    <span>✨ Saved to Your Account</span>
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">
                    We found {scoredData.totalFindings} potential improvements on your resume
                  </h2>
                  <p className="text-sm text-ink-secondary leading-relaxed">
                    Your resume diagnostic has been saved to your account. Open your interactive review workspace to inspect all detected ATS formatting issues, bullet verb enhancements, and metric opportunities — and apply 1-click AI fixes.
                  </p>

                  <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                    {scoredData.resumeId ? (
                      <Link href={`/resume/${scoredData.resumeId}/review`} className="w-full sm:w-auto">
                        <Button size="lg" className="w-full sm:w-auto font-bold shadow-md">
                          View Full Findings &amp; Action Plan &rarr;
                        </Button>
                      </Link>
                    ) : (
                      <Link href="/dashboard" className="w-full sm:w-auto">
                        <Button size="lg" className="w-full sm:w-auto font-bold shadow-md">
                          Go to Dashboard &rarr;
                        </Button>
                      </Link>
                    )}
                    <Link href="/dashboard" className="w-full sm:w-auto">
                      <Button variant="secondary" size="lg" className="w-full sm:w-auto font-semibold">
                        View Dashboard
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="border-2 border-accent/40 bg-paper p-6 sm:p-8 relative overflow-hidden shadow-pop">
                <div className="max-w-xl mx-auto text-center space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-soft text-accent text-xs font-bold">
                    <span>🔒 Unlock Findings Report</span>
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">
                    We found {scoredData.totalFindings} potential improvements on your resume
                  </h2>
                  <p className="text-sm text-ink-secondary leading-relaxed">
                    Create your free account to unlock the full list of detected ATS formatting issues, weak bullet verbs, and metric opportunities — and save your scored resume.
                  </p>

                  {/* Blurred teaser cards */}
                  <div className="my-6 grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-60 pointer-events-none select-none filter blur-[1px]">
                    <div className="p-3.5 rounded-lg border border-border bg-surface text-left">
                      <span className="text-[10px] font-bold uppercase text-critical">High Priority</span>
                      <p className="text-xs font-semibold text-ink mt-0.5">Missing Australian Work Rights Format</p>
                    </div>
                    <div className="p-3.5 rounded-lg border border-border bg-surface text-left">
                      <span className="text-[10px] font-bold uppercase text-attention">Improvement</span>
                      <p className="text-xs font-semibold text-ink mt-0.5">Passive voice in recent work history</p>
                    </div>
                  </div>

                  {/* Signup form */}
                  <div className="pt-2">
                    <Checkbox
                      id="agreeLeadTerms"
                      className="mb-4 text-left justify-center"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      label={
                        <span className="text-xs text-ink-secondary">
                          I agree to the{" "}
                          <Link href="/terms" target="_blank" className="font-medium text-accent underline">
                            Terms &amp; Conditions
                          </Link>{" "}
                          and{" "}
                          <Link href="/privacy" target="_blank" className="font-medium text-accent underline">
                            Privacy Policy
                          </Link>
                        </span>
                      }
                    />

                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full mb-4 shadow-sm"
                      onClick={handleGoogleSignup}
                      isLoading={isGoogleLoading}
                      disabled={!agreedToTerms}
                    >
                      {!isGoogleLoading && <GoogleIcon />}
                      Continue with Google
                    </Button>

                    <div className="flex items-center gap-3 my-4">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[11px] uppercase text-ink-muted font-semibold">or email</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <form onSubmit={handleEmailSignup} className="space-y-3 text-left">
                      <Input
                        id="signupFullName"
                        type="text"
                        label="Full name"
                        value={signupFullName}
                        placeholder={scoredData.candidateName || "Your Name"}
                        onChange={(e) => setSignupFullName(e.target.value)}
                      />
                      <Input
                        id="signupEmail"
                        type="email"
                        label="Email"
                        required
                        value={signupEmail}
                        placeholder="you@example.com"
                        onChange={(e) => setSignupEmail(e.target.value)}
                      />
                      <Input
                        id="signupPassword"
                        type="password"
                        label="Password"
                        required
                        minLength={8}
                        value={signupPassword}
                        placeholder="Min 8 characters"
                        onChange={(e) => setSignupPassword(e.target.value)}
                      />

                      {signupError && (
                        <p className="text-xs text-critical font-medium">{signupError}</p>
                      )}

                      <Button
                        type="submit"
                        className="w-full font-bold"
                        isLoading={isSigningUp}
                        disabled={!agreedToTerms}
                      >
                        Create Free Account &amp; Unlock Report &rarr;
                      </Button>
                    </form>
                  </div>
                </div>
              </Card>
            )}

            {/* Re-score button */}
            <div className="text-center pt-4">
              <button
                type="button"
                onClick={() => {
                  setState("input");
                  setFile(null);
                  setRawText("");
                  setTurnstileToken(null);
                  setCaptchaKey((k) => k + 1);
                }}
                className="text-xs font-semibold text-ink-muted hover:text-ink underline transition-colors"
              >
                Score another resume
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
