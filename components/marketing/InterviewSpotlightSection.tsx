"use client";

import { Fragment, type CSSProperties } from "react";
import Link from "next/link";
import { CheckIcon } from "@/components/ui/icons/LucideIcons";
import { FREE_INTERVIEW_ALLOWANCE, estimateMinutes } from "@/lib/interview/setupConstants";

const FEATURES = [
  "Questions built from the actual job ad, not a generic list.",
  "Phone screen, behavioural, technical, panel and video rounds.",
  "A score on every answer using the STAR method, plus a better way to say it.",
  "Pace, filler words and timing, so you sound confident, not rehearsed.",
];

// Illustrative scores out of 5, the same scale the real report uses (InterviewReportView).
const STAR_PARTS = [
  { label: "Situation", score: 4 },
  { label: "Task", score: 3.5 },
  { label: "Action", score: 4.5 },
  { label: "Result", score: 2 },
];

const ANSWER_WORDS =
  "“Our warehouse lead didn’t trust the new rostering tool, so I worked a week of his shifts with him and rebuilt the templates around how his team actually ran…”".split(" ");

// Same rounded estimate the setup screen shows for the free practice.
const FREE_MINUTES = estimateMinutes(FREE_INTERVIEW_ALLOWANCE.stageType, FREE_INTERVIEW_ALLOWANCE.questionCount);

export function InterviewSpotlightSection() {
  return (
    <section className="section tint" id="interview" data-section="interview">
      <div className="container">
        <div className="feature-row">
          <div className="reveal">
            <span className="eyebrow">Interview practice</span>
            <h2 className="feature-title">Rehearse your interview before the real thing.</h2>
            <p className="lead">
              ApplyLab reads the job ad and your resume, then interviews you like a real Australian hiring panel. Speak or type your answers and get feedback after every question.
            </p>
            <ul className="feature-list">
              {FEATURES.map((feature) => (
                <li key={feature}>
                  <span className="tick"><CheckIcon /></span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <div className="iv-cta">
              <Link className="btn btn-primary" href="/onboarding" data-cta="interview-start">
                Start a free practice interview &rarr;
              </Link>
              <p className="iv-cta-note">
                Your first practice is free once your resume is ready: {FREE_INTERVIEW_ALLOWANCE.questionCount} questions, about {FREE_MINUTES} minutes. Use your voice or type.
              </p>
            </div>
          </div>

          <div className="media reveal iv-demo" role="img" aria-label="Example: feedback on one practice interview answer, scored with the STAR method">
            <div className="iv-head">
              <span className="pill">First phone call &middot; Question 2 of 6</span>
              <span className="score-big">
                3.5<small>/5</small>
              </span>
            </div>
            <p className="iv-q">&ldquo;Tell me about a time you had to win over a difficult stakeholder.&rdquo;</p>
            <span className="iv-live">
              <span className="iv-live-text">
                <span className="iv-live-on">
                  <i aria-hidden="true" /> Answering out loud
                </span>
                <span className="iv-live-done">
                  <CheckIcon className="h-3.5 w-3.5" /> Answer scored
                </span>
              </span>
            </span>
            {/* Words land one by one once the card is revealed, like a live transcript. */}
            <p className="iv-answer">
              {ANSWER_WORDS.map((word, i) => (
                <Fragment key={i}>
                  {i > 0 && " "}
                  <span className="iv-word" style={{ "--i": i } as CSSProperties}>
                    {word}
                  </span>
                </Fragment>
              ))}
            </p>
            <div className="star">
              {STAR_PARTS.map((part) => (
                <div className="row" key={part.label}>
                  <span>{part.label}</span>
                  <div className="bar">
                    <i style={{ width: `${(part.score / 5) * 100}%` }} />
                  </div>
                  <span>{part.score}</span>
                </div>
              ))}
            </div>
            <div className="iv-chips">
              <span>Pace 142 wpm</span>
              <span>Fillers 3</span>
              <span>1m 48s</span>
            </div>
            <div className="iv-tip">
              <b>Coach tip</b> Strong action. Add the result: what changed, and by how much?
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
