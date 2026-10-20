"use client";

import Link from "next/link";
import { CTA } from "@/lib/marketing/copy";
import { STORIES, STORIES_SECTION_MIN } from "@/lib/stories";

// Renders nothing until there are enough real, consented quotes: no placeholder, no empty heading.
export function StoriesSection() {
  if (STORIES.length < STORIES_SECTION_MIN) return null;

  return (
    <section className="section stories-section" id="stories" data-section="stories">
      <div className="container center">
        <span className="eyebrow reveal">Real Australian job seekers</span>
        <h2 className="reveal" style={{ margin: "0 0 14px" }}>
          People like you, getting more interviews.
        </h2>
        <ul className="stories stagger">
          {STORIES.slice(0, 3).map((story) => (
            <li key={story.quote} className="story">
              <blockquote>&ldquo;{story.quote}&rdquo;</blockquote>
              <p className="story-who">
                {story.firstName} &middot; {story.role} &middot; {story.city}
              </p>
              {story.outcome && <p className="story-outcome">{story.outcome}</p>}
            </li>
          ))}
        </ul>
        <div className="section-cta reveal">
          <Link className="btn btn-primary" href="/onboarding" data-cta="stories-start-free">
            {CTA.startFree} &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
