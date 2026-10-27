"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { TermsNotice } from "@/components/auth/TermsNotice";
import { GoogleIcon } from "@/components/ui/icons/GoogleIcon";
import { CheckCircleIcon, FileTextIcon, LockIcon } from "@/components/ui/icons/LucideIcons";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { ScoreSummaryCard } from "@/components/resume/review/ScoreSummaryCard";
import { CategoryScoreRow } from "@/components/resume/review/CategoryScoreRow";
import { ReviewScoringLoader } from "@/components/resume/review/ReviewScoringLoader";
import { trackFunnelEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { TERMS_VERSION } from "@/lib/terms";
import { useMarketingUser } from "@/lib/marketing/useMarketingUser";
import { CTA } from "@/lib/marketing/copy";
import { ACCOUNT_EXISTS_MESSAGE, friendlyAuthError, PASSWORD_RULES_HINT, passwordProblem } from "@/lib/auth/passwordRules";
import { SCORE_CLAIM_CALLBACK_PATH, SCORE_CLAIM_LOGIN_URL, SCORE_CLAIM_PATH } from "@/lib/resume/scoreClaimCookie";
import { dropSearchParam } from "@/lib/url/dropSearchParam";
import type { ResumeReviewCategory, ResumeReviewFinding } from "@/types";

type ScorerState = "input" | "scoring" | "scored" | "error";

const TEASER_LABEL: Record<ResumeReviewFinding["severity"], { text: string; className: string }> = {
  hard_fail: { text: "High priority", className: "text-critical" },
  warning: { text: "Improvement", className: "text-attention" },
  info: { text: "Nice to have", className: "text-ink-muted" },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface ScoredData {
  score: number;
  categories: ResumeReviewCategory[];
  totalFindings: number;
  teasers?: { severity: ResumeReviewFinding["severity"]; title: string }[];
  resumeId: string | null;
  /** True when the score is held for this browser to claim after signup (no account yet). */
  held?: boolean;
  /** The visitor is a guest mid-onboarding: signup converts that account (no captcha needed). */
  isGuest?: boolean;
  contentHash: string;
  candidateName: string | null;
  isAnonymous: boolean;
}

interface PublicResumeScorerProps {
  /** In-page anchor shown under the result as a secondary "how ApplyLab improves it" link. */
  improveHref?: string;
}

export function PublicResumeScorer({ improveHref }: PublicResumeScorerProps = {}) {
  // Fetched client-side rather than passed down from the page's old getCurrentUser() call - both
  // places this is read happen well after mount (after the visitor fills in and submits the
  // scorer form), so there's no meaningful risk of using it before the fetch resolves.
  const { user } = useMarketingUser();
  const isLoggedIn = Boolean(user);
  const [state, setState] = useState<ScorerState>("input");
  const [claimFailed, setClaimFailed] = useState(false);
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
  const [isSigningUp, setIsSigningUp] = useState(false);
  // Supabase requires a captcha on signup, and the scoring captcha above is single-use (already
  // spent on the score request), so the signup form has its own.
  const [signupCaptchaToken, setSignupCaptchaToken] = useState<string | null>(null);
  const [signupCaptchaKey, setSignupCaptchaKey] = useState(0);
  const [signupConfirmationSentTo, setSignupConfirmationSentTo] = useState<string | null>(null);
  const [signupCaptchaProblem, setSignupCaptchaProblem] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Why the submit button is disabled, shown under it so a disabled button never sits there
  // unexplained. Null when the form is ready to submit.
  const submitHint =
    mode === "file" && !file
      ? "Add a PDF or Word file to score."
      : mode === "text" && rawText.trim().length < 50
        ? "Paste at least 50 characters of your resume."
        : !turnstileToken
          ? "Complete the verification above to continue."
          : null;

  useEffect(() => {
    trackFunnelEvent("lead_magnet_page_view");
    // Sent back here by the claim route when adding a held score to the account failed (the
    // ticket is kept). Read after mount: useSearchParams would make this static page dynamic.
    if (new URLSearchParams(window.location.search).get("claim") === "failed") {
      setClaimFailed(true);
      dropSearchParam("claim");
    }
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
      if (data.isAnonymous) {
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

  // The signup captcha token is single-use, so every failed attempt (or a widget that failed to
  // load) gets a fresh check, with any old captcha message cleared.
  function resetSignupCaptcha() {
    setSignupCaptchaToken(null);
    setSignupCaptchaProblem(null);
    setSignupCaptchaKey((k) => k + 1);
  }

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    const weak = passwordProblem(signupPassword);
    setSignupError(weak);
    const isGuest = Boolean(scoredData?.isGuest);
    if (weak || (!isGuest && !signupCaptchaToken)) return; // submit stays disabled until the captcha passes
    setIsSigningUp(true);

    try {
      const supabase = createClient();
      const metadata = { full_name: signupFullName || scoredData?.candidateName || "User", accepted_terms_version: TERMS_VERSION };
      const claimRedirect = `${window.location.origin}${SCORE_CLAIM_CALLBACK_PATH}`;

      // A guest mid-onboarding converts this same account (keeping their progress), as the
      // generate-resume signup does, rather than making a second one. The held score is then
      // claimed into it. Still a guest afterwards means the email is waiting to be confirmed.
      if (isGuest) {
        // Checked now, never trusted from scoring time: the session may have changed since (a real
        // account logged in from another tab, or the guest session ended). updateUser must only
        // ever run on a guest account, or it would change a real account's email and password.
        const {
          data: { user: sessionUser },
        } = await supabase.auth.getUser();
        if (sessionUser && !sessionUser.is_anonymous) {
          // Already signed in to a full account: nothing to sign up, just add the score to it.
          window.location.assign(SCORE_CLAIM_PATH);
          return;
        }
        if (!sessionUser) {
          setIsSigningUp(false);
          setScoredData((current) => (current ? { ...current, isGuest: false } : current));
          setSignupError("Your session ended. Please complete the security check and try again.");
          return;
        }

        const { data: updated, error: updateError } = await supabase.auth.updateUser(
          { email: signupEmail, password: signupPassword, data: metadata },
          { emailRedirectTo: claimRedirect }
        );
        if (updateError) {
          setIsSigningUp(false);
          // The guest session ended since scoring (signed out elsewhere, expired): sign up as a new
          // visitor instead, which needs the captcha that guests skip.
          if (updateError.name === "AuthSessionMissingError") {
            setScoredData((current) => (current ? { ...current, isGuest: false } : current));
            setSignupError("Your session ended. Please complete the security check and try again.");
            return;
          }
          setSignupError(friendlyAuthError(updateError));
          return;
        }
        // Converting an existing account doesn't run the signup trigger that records the terms
        // ticked here, so record them directly (as the generate-resume signup does). Best effort:
        // middleware asks again if this didn't land.
        const { error: termsError } = await supabase.rpc("accept_terms", { p_version: TERMS_VERSION });
        if (termsError) console.error("score signup: failed to record terms acceptance", termsError);
        trackFunnelEvent("lead_magnet_account_created", { source: "email", score: scoredData?.score });
        if (updated.user?.is_anonymous) {
          setSignupConfirmationSentTo(signupEmail);
          setIsSigningUp(false);
          return;
        }
        // The current access token still says "guest" until refreshed, and resume edits are refused
        // for guests, so refresh before opening the report.
        await supabase.auth.refreshSession();
        window.location.assign(SCORE_CLAIM_PATH);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        // Non-null here: a non-guest can't submit without a captcha (checked above).
        options: { data: metadata, emailRedirectTo: claimRedirect, captchaToken: signupCaptchaToken ?? undefined },
      });

      if (error) {
        setSignupError(friendlyAuthError(error));
        setIsSigningUp(false);
        resetSignupCaptcha();
        return;
      }

      // With email confirmation on, Supabase answers an already-registered email with a stand-in
      // user that has no identities, and sends no email (so accounts can't be enumerated).
      if (data.user && data.user.identities?.length === 0) {
        setSignupError(ACCOUNT_EXISTS_MESSAGE);
        setIsSigningUp(false);
        resetSignupCaptcha();
        return;
      }

      trackFunnelEvent("lead_magnet_account_created", {
        source: "email",
        score: scoredData?.score,
      });

      // Email confirmation is on: no session until they click the link, so there's nothing to
      // open yet. Say so here rather than sending them to a page that bounces to log in.
      if (!data.session) {
        setSignupConfirmationSentTo(signupEmail);
        setIsSigningUp(false);
        return;
      }

      // Signed in straight away: the claim route moves the held score into the new account and
      // opens its report. A full page load, since it's a route handler that redirects.
      window.location.assign(SCORE_CLAIM_PATH);
    } catch (err) {
      setSignupError("Signup failed. Please try again.");
      setIsSigningUp(false);
      resetSignupCaptcha();
    }
  }

  async function handleGoogleSignup() {
    setSignupError(null);
    setIsGoogleLoading(true);

    document.cookie = "pending_terms_accept=1; path=/; max-age=600; SameSite=Lax";

    const supabase = createClient();
    // Back through the claim route, which adds the held score to the account.
    const redirectTo = `${window.location.origin}${SCORE_CLAIM_CALLBACK_PATH}`;

    // A guest links Google to this same account (keeping their onboarding progress), as the
    // generate-resume signup does. If linking can't start (e.g. the guest session ended) it falls
    // back to a normal sign-in. A Google account that's already registered comes back to
    // /auth/callback as an error, which sends them to log in with it.
    if (scoredData?.isGuest) {
      // As with email signup, checked now rather than trusted from scoring time: linking must only
      // ever attach Google to a guest account.
      const {
        data: { user: sessionUser },
      } = await supabase.auth.getUser();
      if (sessionUser && !sessionUser.is_anonymous) {
        window.location.assign(SCORE_CLAIM_PATH);
        return;
      }
      if (sessionUser) {
        const { error: linkError } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo } });
        if (!linkError) return;
      }
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });

    if (oauthError) {
      setSignupError(oauthError.message);
      setIsGoogleLoading(false);
    }
  }

  // Logging in adds a held score to the account; with nothing held (holding failed) it just brings
  // them back here to score again.
  const scoreLoginHref = scoredData?.held ? SCORE_CLAIM_LOGIN_URL : `/login?redirectedFrom=${encodeURIComponent("/resume-score")}`;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {claimFailed && (
        <p role="alert" className="mb-4 rounded-lg border border-critical/30 bg-critical-soft/30 p-3 text-sm text-critical">
          We couldn&apos;t add your score to your account just now.{" "}
          {/* A full page load: the claim is a route handler that redirects. */}
          <a href={SCORE_CLAIM_PATH} className="font-semibold underline underline-offset-2">
            Try again
          </a>
        </p>
      )}
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
                  Upload file
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
                  Paste text
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
                      <div className="w-12 h-12 rounded-full bg-accent-soft text-accent flex items-center justify-center">
                        <FileTextIcon className="h-6 w-6" />
                      </div>
                      {file ? (
                        <div>
                          <p className="font-semibold text-ink text-base">{file.name}</p>
                          <p className="text-xs text-ink-muted mt-0.5">
                            {formatFileSize(file.size)} • Ready to score
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
                            PDF or Word, up to 5 MB
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">
                      Paste your resume
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

                {!isLoggedIn && (
                  <p className="text-center text-xs text-ink-secondary">
                    Your score is free. A free account unlocks the full breakdown.
                  </p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  data-cta="score-upload"
                  className="w-full text-base font-bold shadow-md"
                  disabled={Boolean(submitHint)}
                  aria-describedby={submitHint ? "score-submit-hint" : undefined}
                >
                  {CTA.primary} &rarr;
                </Button>
                {submitHint && (
                  <p id="score-submit-hint" className="text-center text-xs text-ink-muted">
                    {submitHint}
                  </p>
                )}
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
                <h3 className="font-display text-lg font-bold text-ink">Your score in 5 areas</h3>
                <span className="text-xs text-ink-muted">Out of 100</span>
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
            {/* The server's answer, not the header's: a session can lapse between page load and scoring. */}
            {!scoredData.isAnonymous ? (
              <Card className="border-2 border-accent/40 bg-surface p-6 sm:p-8 relative overflow-hidden shadow-pop">
                <div className="max-w-xl mx-auto text-center space-y-4">
                  {scoredData.resumeId && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-soft text-accent text-xs font-bold">
                      <span className="inline-flex items-center gap-1"><CheckCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />Saved to your account</span>
                    </div>
                  )}
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">
                    We found {scoredData.totalFindings} potential improvements on your resume
                  </h2>
                  <p className="text-sm text-ink-secondary leading-relaxed">
                    {scoredData.resumeId
                      ? "Your score is saved. Open the full breakdown to see what to fix, with suggested rewrites you can apply in one click."
                      : "We couldn't save this score to your account. Please score your resume again to keep the full breakdown."}
                  </p>

                  <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                    {scoredData.resumeId ? (
                      <Link href={`/resume/${scoredData.resumeId}/review`} className="w-full sm:w-auto" data-cta="score-see-fixes">
                        <Button size="lg" className="w-full sm:w-auto font-bold shadow-md">
                          See what to fix &rarr;
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
                    <LockIcon className="h-3.5 w-3.5" /> <span>Free account</span>
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">
                    Your score is ready. Create a free account to see what to fix.
                  </h2>
                  <p className="text-sm text-ink-secondary leading-relaxed">
                    We found {scoredData.totalFindings} things to fix. Your free account also saves your scored resume.
                  </p>

                  {/* Blurred teaser cards: this resume's real top findings, titles only */}
                  {scoredData.teasers && scoredData.teasers.length > 0 && (
                    <div className="my-6 grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-60 pointer-events-none select-none filter blur-[1px]">
                      {scoredData.teasers.map((teaser, i) => (
                        <div key={i} className="p-3.5 rounded-lg border border-border bg-surface text-left">
                          <span className={`text-[10px] font-bold uppercase ${TEASER_LABEL[teaser.severity].className}`}>
                            {TEASER_LABEL[teaser.severity].text}
                          </span>
                          <p className="text-xs font-semibold text-ink mt-0.5">{teaser.title}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Signup form */}
                  <div className="pt-2">
                    {signupConfirmationSentTo ? (
                      <div className="text-left" role="status">
                        <p className="text-sm font-semibold text-ink">Check your inbox</p>
                        <p className="mt-1 text-sm text-ink-secondary">
                          We&apos;ve sent a confirmation link to{" "}
                          <strong className="font-semibold text-ink">{signupConfirmationSentTo}</strong>.{" "}
                          {scoredData.held
                            ? "Open it in this browser to activate your account, and your score report will be waiting."
                            : "Click it to activate your account."}{" "}
                          It can take a minute, and sometimes lands in spam or junk.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSignupConfirmationSentTo(null);
                            resetSignupCaptcha();
                          }}
                          className="mt-3 text-sm font-medium text-accent hover:text-accent-hover"
                        >
                          Wrong email? Go back
                        </button>
                      </div>
                    ) : (
                    <>
                    <TermsNotice className="mb-3" />

                    <Button
                      type="button"
                      variant="secondary"
                      data-cta="score-signup-google"
                      className="w-full mb-4 shadow-sm"
                      onClick={handleGoogleSignup}
                      isLoading={isGoogleLoading}
                    >
                      {!isGoogleLoading && <GoogleIcon />}
                      Continue with Google
                    </Button>

                    <div className="flex items-center gap-3 my-4">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[11px] uppercase text-ink-muted font-semibold">or email</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    {!scoredData.held && (
                      <p className="mb-3 text-left text-xs text-ink-muted">
                        We couldn&apos;t keep this score for your new account, so you&apos;ll need to score your resume
                        again after signing up.
                      </p>
                    )}
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
                        autoComplete="new-password"
                        required
                        aria-describedby="signupPasswordRules"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                      />
                      <p id="signupPasswordRules" className="-mt-2 text-xs text-ink-muted">{PASSWORD_RULES_HINT}</p>

                      {/* A guest is already signed in, so converting their account needs no captcha. */}
                      {!scoredData.isGuest && (
                      <>
                      <div className="flex justify-center">
                        <TurnstileWidget
                          key={signupCaptchaKey}
                          onVerify={(token: string) => {
                            setSignupCaptchaToken(token);
                            setSignupCaptchaProblem(null);
                          }}
                          onExpire={() => {
                            setSignupCaptchaToken(null);
                            setSignupCaptchaProblem("The security check expired. Please complete it again.");
                          }}
                          onError={() => {
                            setSignupCaptchaToken(null);
                            setSignupCaptchaProblem("The security check couldn't load.");
                          }}
                        />
                      </div>
                      {/* Kept apart from signupError so a captcha re-check can't wipe a signup error. */}
                      {signupCaptchaProblem ? (
                        <p className="text-xs text-critical font-medium">
                          {signupCaptchaProblem}{" "}
                          {/* Reloads only the check: refreshing the page would lose the score. */}
                          <button type="button" onClick={resetSignupCaptcha} className="underline underline-offset-2">
                            Try again
                          </button>
                        </p>
                      ) : (
                        !signupCaptchaToken && (
                          <p className="text-xs text-ink-muted">Complete the security check above to continue.</p>
                        )
                      )}
                      </>
                      )}

                      {signupError && (
                        <p role="alert" className="text-xs text-critical font-medium">
                          {signupError}
                          {signupError === ACCOUNT_EXISTS_MESSAGE && (
                            <>
                              {" "}
                              <Link
                                href={scoreLoginHref}
                                className="underline underline-offset-2"
                              >
                                Log in
                              </Link>
                            </>
                          )}
                        </p>
                      )}

                      <Button
                        type="submit"
                        data-cta="score-signup-email"
                        className="w-full font-bold"
                        isLoading={isSigningUp}
                        disabled={!scoredData.isGuest && !signupCaptchaToken}
                      >
                        Create Free Account &amp; Unlock Report &rarr;
                      </Button>
                      <p className="text-center text-xs text-ink-muted">
                        Already have an account?{" "}
                        <Link href={scoreLoginHref} className="font-semibold text-accent underline underline-offset-2">
                          Log in
                        </Link>
                        {scoredData.held && " and we'll add this score to it"}.
                      </p>
                    </form>
                    </>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {improveHref && (
              <p className="text-center">
                <a href={improveHref} data-cta="score-improve" className="text-sm font-semibold text-ink-secondary hover:text-ink underline underline-offset-4 transition-colors">
                  See how ApplyLab improves it &darr;
                </a>
              </p>
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
                  // A new score gets a fresh signup gate (and no stale single-use captcha token).
                  setSignupConfirmationSentTo(null);
                  setSignupError(null);
                  resetSignupCaptcha();
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
