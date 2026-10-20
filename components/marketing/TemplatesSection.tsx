"use client";

import { useState } from "react";
import Link from "next/link";

interface TemplateItem {
  id: string;
  name: string;
  tag: string;
  isPopular?: boolean;
  alt: string;
}

const TEMPLATES: TemplateItem[] = [
  {
    id: "clean",
    name: "Clean",
    tag: "Most popular",
    isPopular: true,
    alt: "Clean ATS resume template with Australian formatting",
  },
  {
    id: "classic",
    name: "Classic",
    tag: "Traditional",
    alt: "Classic traditional ATS resume template",
  },
  {
    id: "modern",
    name: "Modern",
    tag: "Design-forward",
    alt: "Modern design-forward resume template with orange header band",
  },
  {
    id: "compact",
    name: "Compact",
    tag: "Dense",
    alt: "Compact dense single-column ATS resume template",
  },
  {
    id: "editorial",
    name: "Editorial",
    tag: "Executive",
    alt: "Editorial executive ATS resume template with dark header band",
  },
  {
    id: "technical",
    name: "Technical",
    tag: "Skills-first",
    alt: "Technical two-column ATS resume template with skills sidebar",
  },
  {
    id: "executive",
    name: "Executive",
    tag: "Leadership",
    alt: "Executive leadership ATS resume template",
  },
  {
    id: "minimal",
    name: "Minimal",
    tag: "Pure ATS",
    alt: "Minimal pure ATS resume template with clean whitespace",
  },
];

// Shown by default; the rest wait behind "See all" so the section has one clear next step.
const FEATURED_IDS = ["clean", "classic", "modern", "minimal"];
const FEATURED = TEMPLATES.filter((t) => FEATURED_IDS.includes(t.id));
const MORE = TEMPLATES.filter((t) => !FEATURED_IDS.includes(t.id));

function TemplateCard({ tmpl }: { tmpl: TemplateItem }) {
  return (
    <li className="tmpl">
      <div className="paper">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/templates/${tmpl.id}.webp`}
          srcSet={`/templates/${tmpl.id}.webp 1x, /templates/${tmpl.id}@2x.webp 2x`}
          width={600}
          height={849}
          loading="lazy"
          alt={tmpl.alt}
        />
      </div>
      <div className="name">{tmpl.name}</div>
      <div className={`tag ${tmpl.isPopular ? "pop" : ""}`}>{tmpl.tag}</div>
    </li>
  );
}

export function TemplatesSection() {
  const [showAll, setShowAll] = useState(false);

  return (
    <section className="section" id="templates" data-section="templates">
      <div className="container center">
        <h2 className="reveal" style={{ margin: "0 0 14px" }}>
          Clean templates Australian recruiters actually read.
        </h2>
        <p className="lead reveal">
          Each fits one A4 page, reads cleanly in ATS (the software employers use to filter resumes), and downloads as PDF or Word.
        </p>

        <ul className="grid-templates stagger">
          {FEATURED.map((tmpl) => (
            <TemplateCard key={tmpl.id} tmpl={tmpl} />
          ))}
        </ul>
        {/* Kept in the DOM while hidden: display:none stops the lazy images loading until opened. */}
        <ul id="more-templates" className="grid-templates grid-templates-more" hidden={!showAll}>
          {MORE.map((tmpl) => (
            <TemplateCard key={tmpl.id} tmpl={tmpl} />
          ))}
        </ul>

        <div className="templates-actions reveal">
          <button
            type="button"
            className="text-link"
            aria-expanded={showAll}
            aria-controls="more-templates"
            data-cta="templates-see-all"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Show fewer templates" : `See all ${TEMPLATES.length} templates`}
          </button>
          <Link className="btn btn-primary" href="/onboarding" data-cta="templates-start">
            Start with a template &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
