# ApplyLab — implementation brief for the dev agent

## 0. What to build & the source of truth
Attached: **`applylab-landing.html`** — a complete, working single-file prototype of the redesigned landing page (Enhancv-style layout in ApplyLab orange). It is the **visual + interaction source of truth**. Your job:

1. Port it faithfully into our production stack, keeping the look, motion, and structure identical.
2. Write it as **efficiently and bug-free as possible** (this is the top priority — see §1 and §4).
3. Replace the CSS "mini-resume" placeholders in the Templates section with **real, generated template preview images** (see §3).

Do **not** redesign or add features beyond what's in the prototype. Keep all copy as-is. Do not copy any competitor's assets, images, or text — everything here is original ApplyLab content.

---

## 1. Non-negotiable rules (efficiency + correctness)

### Efficiency
- **One source of truth for design tokens.** Colours, radii, shadows, spacing, and the orange `--mesh` gradient live once (CSS custom properties or the Tailwind theme). No hardcoded hex/px in components. Changing `--primary` must recolour the entire site.
- **One `IntersectionObserver`** drives every scroll reveal *and* the stat count-up, and `unobserve`s each element after it fires. No scroll or resize listeners for reveals.
- **Nav elevation uses a sentinel `IntersectionObserver`** (a 1px element at the top), not a scroll handler.
- **CSS-only wherever possible:** mega-menu dropdowns (`:hover` / `:focus-within`), FAQ accordion (`grid-template-rows: 0fr → 1fr`), all hover states, the hero float. JS only for: count-up, nav sentinel, mobile menu toggle.
- **Motion is `transform`/`opacity` only** (GPU-composited). No animating layout properties.
- **No animation library** unless one is already in our bundle. If we're on React, a single `useReveal` IntersectionObserver hook is lighter than Framer Motion — prefer the hook.
- **Images:** modern format (WebP/AVIF), `loading="lazy"` for everything below the fold, explicit `width`/`height` (or `aspect-ratio`) to prevent layout shift, `srcset` for 1x/2x. Preload only the hero.
- **Ship no dead code.** The prototype has a few now-unused legacy rules (e.g. `.paper .h`, `.paper .accent`, `.paper .l`) — remove them. De-duplicate any repeated inline styles into classes when porting.

### Correctness — build to pass this checklist
- **Sticky-header anchor offset:** add `scroll-margin-top` to every section target (≈ header height + 12px) or `scroll-padding-top` on `html`, so anchored headings aren't hidden under the sticky nav. (Currently they would be.)
- **No inline style overriding responsive rules.** Grids that must collapse use `.card-grid.cols-3` / `.cols-4` (they go 1-column under 960px). Never set `grid-template-columns` inline on a grid that needs to be responsive — inline wins over the media query and silently breaks mobile.
- **Reveal fallback (important):** content must be visible if JS is disabled or fails. Add a `.js` class to `<html>` via a tiny inline script *before* paint, and scope the "start hidden" reveal styles to `html.js .reveal`. Never let content be permanently invisible because an observer didn't run.
- **Count-up:** fires once, no re-trigger, eases to the **exact** final value (no overshoot), formats correctly (`4.8`, `1.4s`, `3,400+`, `100%`). Under reduced motion, show final numbers immediately.
- **Mega-menu a11y & behaviour:** keyboard operable (`:focus-within` + `aria-haspopup`/`aria-expanded`), closes on `Esc`, hover-bridge present so it doesn't snap shut crossing the gap. Mobile: flattens to static, locks body scroll while open, closes on link tap and when resizing back to desktop.
- **`prefers-reduced-motion`:** disables float, reveals, smooth scroll, and count-up animation.
- **No CLS:** reserve image dimensions; load fonts with `font-display: swap` and a sensible fallback stack.
- **Cross-browser:** provide a `backdrop-filter` fallback (solid background) for the nav; verify the `grid-rows 0fr` accordion in Safari (fall back to `max-height` transition only if we must support old Safari); verify `aspect-ratio`.
- **Visible focus rings** on every interactive element. Colour contrast ≥ WCAG AA on text over the mesh.
- Test at **375 / 768 / 1024 / 1440**. Zero console errors/warnings.

---

## 2. Gaps in the prototype to resolve during the port
- **`#score` section is missing.** The hero CTA ("Score your resume free") and the Resume menu link to `#score`, but no section has that id yet. Build the **Free Resume Diagnostic** section (drag-and-drop upload for PDF/DOCX up to 5MB, "Paste text" tab, "Get Free Resume Score" button) and give it `id="score"`. Match the styling of the other sections.
- **Verify every nav href resolves.** Existing ids: `#traceable`, `#templates`, `#why`, `#how`, `#extension`, `#cover-letters`, `#interview`, `#tracker`, `#pricing`, `#faq` (plus `#score` once added). Fail the build if any nav/CTA href has no matching id.
- **Founder note & testimonial** from the live site aren't in the prototype — add them as styled blocks if we want parity (optional, confirm with product).

---

## 3. Resume template preview images (the "better images" ask)

Replace the CSS mini-resume placeholders inside each `.paper` with **8 real preview images**. Requirements: attractive, genuinely ATS-authentic (real text, standard fonts, clear headings, one A4 page, **no photos**), original designs, on-brand (orange accents on some, neutral on others).

### Preferred method — render real HTML/CSS résumés to images (do this)
This gives crisp, real-looking, licence-free previews, tiny files, and the templates double as actual export templates later. **Do not use an AI image generator for these** — image models produce garbled, unreadable "text" on résumés and won't look ATS-real.

Steps:
1. Build **8 distinct A4 résumé templates** in HTML/CSS at 794×1123px (@96dpi; render at 2× → 1588×2246 for retina). Use **original placeholder content** (invented AU names, `04xx` numbers, plausible bullets — never real people). Vary the layouts:
   - **Clean** – single column, orange section headings (most popular)
   - **Classic** – single column, neutral/traditional
   - **Modern** – orange header band
   - **Compact** – dense single column
   - **Editorial** – dark header band, editorial spacing
   - **Technical** – two-column with a skills sidebar
   - **Executive** – dark header band, senior tone
   - **Minimal** – sparse, lots of whitespace, pure ATS
2. Render each to **WebP** with a headless browser (**Playwright** or **Puppeteer**) via a repeatable script (`scripts/render-templates.ts`). Export a card size (~600px wide) **and** a 2× version. Target **< 40 KB each**, strip metadata.
3. Output to `/public/templates/{clean,classic,modern,compact,editorial,technical,executive,minimal}.webp`.
4. Wire into the card: replace the `<div class="mini …">…</div>` with
   `<img src="/templates/clean.webp" srcset="/templates/clean.webp 1x, /templates/clean@2x.webp 2x" width="600" height="849" loading="lazy" alt="Clean résumé template">`.
   `.paper` already sets the A4 aspect ratio and rounded clip, so images drop in cleanly.
5. Keep the existing **hover-zoom** on `.tmpl`; consider a "Use this template →" button revealed on hover.

### Fallback only
If a headless render pipeline truly isn't available, keep the current CSS mini-résumés (they're crisp and themeable) rather than shipping AI-generated résumé images. Reserve any image generator for abstract/blurred décor only, never for readable résumé content.

---

## 4. Acceptance criteria (definition of done)
- Visually and behaviourally matches `applylab-landing.html`; orange throughout, no green.
- Lighthouse: **Performance ≥ 90, Accessibility ≥ 95**, best-practices green; **CLS ≈ 0**.
- Single token source; `--primary` swap recolours everything; **no unused CSS**; no console errors.
- One IntersectionObserver for reveals + count-up; nav sentinel observer; no scroll listeners.
- All nav/CTA hrefs resolve (incl. new `#score`); anchor scrolling clears the sticky header.
- Mega-menu works with mouse, keyboard, and on mobile; `Esc` and outside-click close it.
- `prefers-reduced-motion` fully respected; content visible with JS disabled.
- 8 template previews are crisp, ATS-authentic, on-brand, `< 40 KB` each, lazy-loaded with reserved dimensions.
- Responsive and clean at 375 / 768 / 1024 / 1440.

**Attach `applylab-landing.html` to this task** so the agent has the reference markup, tokens, and animation timings.
