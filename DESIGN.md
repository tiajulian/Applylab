---
name: ApplyLab
description: All-in-one job-application tool — resume builder, cover letters, tracker, and interview prep.
colors:
  accent: "oklch(0.52 0.14 45)"
  accent-hover: "oklch(0.46 0.14 45)"
  accent-soft: "oklch(0.94 0.03 45)"
  on-accent: "oklch(0.99 0.005 45)"
  paper: "oklch(0.985 0.006 75)"
  paper-deep: "oklch(0.96 0.01 75)"
  surface: "oklch(0.99 0.004 75)"
  ink: "oklch(0.22 0.02 75)"
  ink-secondary: "oklch(0.45 0.02 75)"
  ink-muted: "oklch(0.55 0.02 75)"
  border: "oklch(0.88 0.01 75)"
  border-strong: "oklch(0.85 0.01 75)"
  success: "oklch(0.5 0.13 155)"
  success-soft: "oklch(0.96 0.015 155)"
  attention: "oklch(0.5 0.13 85)"
  attention-soft: "oklch(0.97 0.02 85)"
  critical: "oklch(0.55 0.16 25)"
  critical-soft: "oklch(0.95 0.035 25)"
  info: "oklch(0.48 0.2 264)"
  info-soft: "oklch(0.97 0.014 255)"
typography:
  display:
    fontFamily: "var(--font-display), Georgia, serif"
    fontSize: "44px"
    fontWeight: 560
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  h2:
    fontFamily: "var(--font-sans), 'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 520
    lineHeight: 1.15
  h3:
    fontFamily: "var(--font-sans), 'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "var(--font-sans), 'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
  body-lg:
    fontFamily: "var(--font-sans), 'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "18px"
    lineHeight: 1.6
  meta:
    fontFamily: "var(--font-sans), 'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "13px"
    lineHeight: 1.5
rounded:
  sm: "14px"
  DEFAULT: "22px"
  lg: "18px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "4px"
    padding: "10px 14px"
---

# Design System: ApplyLab

## Overview

**Creative North Star: "The Command Center"**

ApplyLab is built for a job seeker who is applying to many similar roles at once, not perfecting a single application. The interface reflects that: a calm, warm-neutral paper surface stays quiet by default, and the single orange accent is reserved for the action that moves an application forward — send, generate, download, upgrade. Nothing competes with that signal.

The system runs on two coordinated layers rather than two identities: a bolder, higher-contrast type and spacing rhythm on Persuade surfaces (landing, pricing) where the goal is to convince, and a quieter, denser rhythm on Operate surfaces (dashboard, editor, tracker, admin) where the goal is throughput. Both draw from the same accent, paper, and ink tokens — the difference is scale and restraint, not palette.

**Key Characteristics:**
- One accent color (warm orange), used sparingly, always meaning "act now."
- Warm off-white paper background, never stark white-on-white or cold gray.
- Pill-shaped buttons and soft, rounded cards — no sharp corners anywhere in the system.
- Motion is short and purposeful (140–320ms), never decorative for its own sake.

## Colors

Warm-neutral base (paper, ink) with a single orange accent and four semantic status colors; no secondary or tertiary brand color exists — don't introduce one.

### Primary
- **Ember Accent** (`oklch(0.52 0.14 45)` / `#EA580C`): the one color that means "do this next" — primary buttons, active nav states, focus rings, links that drive action. Reserve it; it loses meaning if it colors more than a small fraction of any screen.
- **Ember Hover** (`oklch(0.46 0.14 45)` / `#C2410C`): darkens on hover/press for every accent-colored interactive element.
- **Ember Soft** (`oklch(0.94 0.03 45)` / `#FFF7ED`): tint background for badges, pills, and highlighted rows — never for large surfaces.

### Neutral
- **Paper** (`oklch(0.985 0.006 75)` / `#FBFAF9`): the page background. Warm, not white.
- **Paper Deep** (`oklch(0.96 0.01 75)` / `#F3F1ED`): secondary surfaces — skeleton loaders, kanban columns, recessed panels.
- **Surface** (`oklch(0.99 0.004 75)` / `#FFFFFF`): cards, inputs, and anything that sits visibly "on top of" paper.
- **Ink** (`oklch(0.22 0.02 75)` / `#171717`): primary text and headings. Warm near-black, not pure black.
- **Ink Secondary** (`oklch(0.45 0.02 75)` / `#4B5563`): body copy, secondary labels.
- **Ink Muted** (`oklch(0.55 0.02 75)` / `#6B7280`): captions, metadata, placeholder text.
- **Border** (`oklch(0.88 0.01 75)` / `#EAE7E2`) / **Border Strong** (`oklch(0.85 0.01 75)` / `#D1CDC7`): hairline dividers and outlined buttons/inputs, respectively.

### Status
- **Success** (`oklch(0.5 0.13 155)` / `#16A34A`) — completed states, positive resume-score signals.
- **Attention** (`oklch(0.5 0.13 85)` / `#D97706`) — a field or state that needs the user's attention but isn't an error (pairs with the `pulse-amber` highlight animation).
- **Critical** (`oklch(0.55 0.16 25)` / `#DC2626`) — errors, destructive actions.
- **Info** (`oklch(0.48 0.2 264)` / `#1D4ED8`) — neutral informational callouts.

Each status color has a `-soft` tint (e.g. `success-soft`) for its background/badge form; never pair a status color's text directly on its own soft tint's complement — use the soft tint as background with the solid color as text/icon.

### Named Rules
**The One Signal Rule.** Ember Accent marks exactly one thing per view: the next action. A view with two competing orange elements has a hierarchy bug, not a style choice.

## Typography

**Sans (UI):** `var(--font-sans)` → `'Plus Jakarta Sans'` fallback — every Operate surface (dashboard, editor, tracker, forms).
**Display (marketing headlines):** `var(--font-display)` → Georgia serif fallback — Persuade-surface hero headlines only.

**Character:** Confident and slightly heavier on Persuade surfaces (headlines run at 800-weight with tight tracking in the current landing implementation); calmer and lighter on Operate surfaces (the Tailwind `display`/`h2`/`h3` scale sits at 520–600 weight). The same family, two levels of intensity.

### Hierarchy
- **Display** (560, 44px, 1.05, -0.01em): Operate-surface page/section titles. Persuade-surface hero `h1` uses a bolder ad-hoc clamp (800 weight, `clamp(2.4rem,5.2vw,4rem)`) — a distinct, louder variant reserved for landing/pricing heroes, not app UI.
- **H2** (520, 30px, 1.15): section headings within a dashboard page.
- **H3** (600, 20px, 1.3): card/panel titles.
- **Body-lg** (18px, 1.6): lead paragraphs on Persuade surfaces.
- **Body** (16px, 1.6): default UI and copy text.
- **Meta** (13px, 1.5): timestamps, captions, table metadata.

### Named Rules
**The Two-Register Rule.** Marketing headlines are allowed to be loud (800 weight, large clamp); app UI headings are not. Don't borrow the landing `h1`/`h2` styles into dashboard pages, and don't soften a landing hero to match the app's quieter scale.

## Layout

Persuade surfaces use a max `1180px` container and generous `104px` vertical section padding (`72px` under 960px) — the rhythm of a marketing page meant to be scrolled through. Operate surfaces (dashboard, editor, tracker) are denser: components lean on the `Card` primitive's own `content` (24px) or `compact` (16px) padding rather than page-level section spacing, since the unit of layout is a panel or table row, not a full-bleed section.

Responsive behavior collapses multi-column grids (hero, stats, template grid, feature rows, comparison table, pricing) to a single column under `960px`; this is the one hard breakpoint in the system rather than a full responsive scale.

## Elevation & Depth

Hybrid, not flat. Cards and panels carry a soft ambient shadow at rest (`--shadow`, `0 10px 30px -12px rgba(23,23,23,.12)`) — depth is always present, never purely a hover response. Interactive elements add a *second*, stronger shadow plus a small upward translate on hover (buttons: `translateY(-1px)`; template cards: `translateY(-6px)` with `--shadow-lg`), so hover reads as "this lifts further," not "this gains depth from nothing."

### Shadow Vocabulary
- **`shadow-sm`** (`0 1px 3px rgba(23,23,23,.05), 0 1px 2px rgba(23,23,23,.04)`): inputs, low-emphasis controls.
- **`shadow-soft`** (`0 2px 10px rgba(23,23,23,.05)`): resting cards, kanban cards.
- **`shadow`** (`0 10px 30px -12px rgba(23,23,23,.12)`): the default card/media elevation.
- **`shadow-pop`** (`0 12px 32px -8px rgba(23,23,23,.12), 0 4px 12px -4px rgba(23,23,23,.06)`): tooltips, popovers, highlighted callouts.
- **`shadow-lg`** (`0 24px 60px -20px rgba(23,23,23,.2)`): hover states, mega-menu, modals — the "lifted above everything" tier.

### Named Rules
**The Always-Some-Depth Rule.** Nothing in this system sits perfectly flat against paper. If a new component has no shadow at all, give it at least `shadow-sm` or a `border` — pure flat-on-flat is an omission, not a deliberate choice here.

## Shapes

Rounded everywhere, no sharp corners. Buttons and pills are fully round (`rounded-pill`, 999px). Cards and panels use `rounded-lg` (18px) or the default `22px` radius; small chips/fields use `rounded-sm` (14px) or a plain 4–10px radius for dense inline elements (inputs, small tags). Note the naming is non-monotonic as currently defined — `lg` (18px) is smaller than the unnamed `DEFAULT` (22px) — treat that as an existing quirk to preserve, not a bug to silently "fix" mid-task.

## Components

### Buttons
- **Shape:** fully pill (`rounded-pill`).
- **Primary:** `bg-accent` / `text-on-accent`, `shadow-sm` at rest.
- **Hover / Focus:** `-translate-y-px` on hover, `translate-y-px` on active (press-down), 2px `ring` (accent at 35% opacity) with 2px offset on focus-visible. Transition covers background-color, color, transform, box-shadow at `duration-fast` (140ms) with the shared `ease-editorial` curve.
- **Secondary / Outline:** transparent background, `border-border-strong`, hover fills `bg-paper-deep`.
- **Ghost:** no border, `text-accent`, hover fills `bg-accent-soft`.
- **Disabled:** 50% opacity, hover/active transforms suppressed, `cursor-not-allowed`.

### Cards
- **Corner Style:** `rounded-lg`.
- **Background:** `bg-surface` (white), `border-border`.
- **Density:** `content` (24px padding) for profile/settings/review panels; `compact` (16px) for stat tiles and kanban cards — pick by content type, not by eyeballing spacing per instance.
- **Shadow Strategy:** see Elevation — resting shadow present, not flat.

### Inputs
- **Style:** `rounded` (small, ~4-10px — distinct from the card/button radius scale), `border-border`, `bg-surface`.
- **Focus:** `border-accent` + 2px accent ring.
- **Error:** `border-critical` + critical-tinted ring; error text in `text-critical` beneath the field.
- **Highlighted (needs attention):** `animate-pulse-amber` border pulse plus a small floating tooltip — reserved for drawing the eye back to a specific field (e.g. a required field after a failed submit), not for general emphasis.

### Navigation
- Sticky header, translucent (`backdrop-filter: blur`) at rest, gains a solid background + `shadow-soft` + border once scrolled past the top sentinel. Nav links are text-only until hover/focus, which tints them into `accent-hover` on an `accent-soft` background pill — the same "soft tint behind, solid color as content" pattern used for status badges.

## Do's and Don'ts

### Do:
- **Do** keep the accent color to one meaningful action per view (The One Signal Rule).
- **Do** use `Card`'s `density` prop instead of hand-tuning padding per instance.
- **Do** respect `prefers-reduced-motion` — the system already disables float/reveal/count-up globally; new motion must check the same media query, not add its own escape hatch.
- **Do** keep Persuade-surface type bold (800-weight display) and Operate-surface type restrained (520–600 weight) — don't blend the two registers on one page.

### Don't:
- **Don't** introduce a second brand accent color. Status colors (success/attention/critical/info) cover every non-accent signal need.
- **Don't** use pure white-on-white or cold gray neutrals — every neutral in this system carries the same warm 75° hue tint (`--*-ch` OKLCH channel values share hue 75).
- **Don't** set `grid-template-columns` inline on a responsive grid — the implementation brief already flags this as a real regression that silently breaks the `960px` mobile collapse.
- **Don't** add a shadow-free, flat-against-paper surface (The Always-Some-Depth Rule) unless it's intentionally recessed (`paper-deep`) rather than floating.
