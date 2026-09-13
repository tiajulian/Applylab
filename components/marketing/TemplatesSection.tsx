"use client";

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

export function TemplatesSection() {
  return (
    <section className="section" id="templates">
      <div className="container center">
        <span className="eyebrow reveal">Eight ATS-safe templates</span>
        <h2 className="reveal" style={{ margin: "16px 0 14px" }}>
          What you actually get, shown not described.
        </h2>
        <p className="lead reveal">
          Every template fits one A4 page, passes Australian ATS parsers cleanly, and exports as a pixel-perfect PDF and an editable Word document.
        </p>

        <div className="grid-templates stagger">
          {TEMPLATES.map((tmpl) => (
            <div key={tmpl.id} className="tmpl">
              <div className="paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/templates/${tmpl.id}.webp`}
                  srcSet={`/templates/${tmpl.id}.webp 1x, /templates/${tmpl.id}@2x.webp 2x`}
                  width={600}
                  height={849}
                  loading="lazy"
                  alt={tmpl.alt}
                  className="w-full h-full object-cover block"
                />
                <div className="use-overlay">
                  <Link href="/onboarding" className="use-btn">
                    Use this template &rarr;
                  </Link>
                </div>
              </div>
              <div className="name">{tmpl.name}</div>
              <div className={`tag ${tmpl.isPopular ? "pop" : ""}`}>{tmpl.tag}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
