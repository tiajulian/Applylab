---
name: ApplyLab
description: All-in-one job-application tool — resume builder, cover letters, tracker, and interview prep.
colors:
  accent: "#B74F15" # brand-700
  accent-hover: "#953E0D" # brand-800
  accent-soft: "#FEE7DE" # brand-100
  on-accent: "#FFFFFF"
  brand-500: "#D76225" # exact logo orange
  paper: "#FAF6F3" # neutral-50
  paper-deep: "#F3EDE9" # neutral-100
  surface: "#FFFFFF"
  ink: "#1F1915" # neutral-900
  ink-secondary: "#5B544E" # neutral-600
  ink-muted: "#726A64" # neutral-500
  border: "#E6E0DB" # neutral-200
  border-strong: "#938A84" # neutral-400
  success: "#1D7339"
  success-soft: "#E6FAE9"
  attention: "#895709"
  attention-soft: "#FFF2D8"
  critical: "#B32E2A"
  critical-soft: "#FEEBE9"
  info: "#1F4FCC"
  info-soft: "#EFF6FF"
typography:
  display:
    fontFamily: "var(--font-display), Georgia, serif"
    fontSize: "36px"
    fontWeight: 560
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  h2:
    fontFamily: "var(--font-sans), 'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 520
    lineHeight: 1.2
  h3:
    fontFamily: "var(--font-sans), 'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.35
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
    height: "40px"  # 44px under 640px, for touch
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
    padding: "20px"
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

Warm-neutral base (paper, ink) with one orange brand scale and three status colors (plus info). All values live once in `app/globals.css` `:root` as bare "R G B" channels; `tailwind.config.ts` wraps them so opacity modifiers work. Components use the role names (accent, ink, border, ...), not the raw scales.

### Brand (the logo's hue, oklch h 44.4, at every step)
| Token | Hex | Use |
|---|---|---|
| brand-50 | #FEF4F0 | pale tints (welcome banner, icon chips) |
| brand-100 | #FEE7DE | **accent-soft**: active nav item, active tab count pill, badges |
| brand-200 | #FFD1BE | tint borders, artwork |
| brand-300 | #FEAE8B | underline decoration, accent text on the dark landing band |
| brand-400 | #F48553 | glows/accent on the dark landing band |
| brand-500 | #D76225 | **the exact logo orange**: logo, icons, small accents only (3.7:1 on white, never text) |
| brand-600 | #CA5A1F | |
| brand-700 | #B74F15 | **accent**: primary buttons, text links, active tab underline, step badge |
| brand-800 | #953E0D | **accent-hover**; text on brand tints |
| brand-900 | #6C2D0B | |

### Warm neutral (hue 60)
| Token | Hex | Role |
|---|---|---|
| neutral-0 | #FFFFFF | **surface**: cards, inputs (cards also get `shadow-sm`) |
| neutral-50 | #FAF6F3 | **paper**: page background |
| neutral-100 | #F3EDE9 | **paper-deep**: recessed panels, hover grey |
| neutral-200 | #E6E0DB | **border**: dividers, card edges |
| neutral-300 | #D4CCC6 | artwork, muted dots |
| neutral-400 | #938A84 | **border-strong**: inputs, outlined buttons (3:1 boundary) |
| neutral-500 | #726A64 | **ink-muted**: dates, captions, placeholders |
| neutral-600 | #5B544E | **ink-secondary**: company names, subtitles, body copy |
| neutral-700 | #453E39 | sidebar item text |
| neutral-900 | #1F1915 | **ink**: headings and primary text |

### Status (badges and score bars only, never buttons or links)
| Role | Text | Background |
|---|---|---|
| success (good score) | #1D7339 | #E6FAE9 |
| attention (okay score) | #895709 | #FFF2D8 |
| critical (needs work, errors) | #B32E2A | #FEEBE9 |
| info | #1F4FCC | #EFF6FF |

Score badges and bars pick their status color from `components/ui/scoreBands.ts` (80+ good, 60-79 okay, below 60 needs work). Change the thresholds there only.

### Contrast (WCAG AA)
| Text / element | On | Ratio |
|---|---|---|
| white | brand-700 (primary button) | 5.07 |
| white | brand-800 (button hover) | 7.06 |
| brand-700 link | paper / white | 4.72 / 5.07 |
| brand-800 | brand-100 (active nav, count pill) | 5.95 |
| ink | paper / white | 16.17 / 17.38 |
| ink-secondary | paper / white | 6.92 / 7.44 |
| ink-muted | paper / white / paper-deep | 4.93 / 5.30 / 4.57 |
| success / attention / critical text | own soft tint | 5.39 / 5.52 / 5.47 |
| border-strong (boundary) | white / paper | 3.38 / 3.15 |
| brand-500 icon | white / paper | 3.71 / 3.45 |

### Named Rules
**The One Signal Rule.** Brand orange marks actions and navigation (the next step, where you are). It never shows a score or status: those use the status colors. A view with two competing orange buttons has a hierarchy bug, not a style choice.

## Typography

**Sans (UI):** `var(--font-sans)` → `'Plus Jakarta Sans'` fallback — every Operate surface (dashboard, editor, tracker, forms).
**Display (marketing headlines):** `var(--font-display)` → Georgia serif fallback — Persuade-surface hero headlines only.

**Character:** Confident and slightly heavier on Persuade surfaces (headlines run at 800-weight with tight tracking in the current landing implementation); calmer and lighter on Operate surfaces (the Tailwind `display`/`h2`/`h3` scale sits at 520–600 weight). The same family, two levels of intensity.

### Hierarchy
- **Display** (560, 36px, 1.05, -0.01em): Operate-surface page/section titles. Persuade-surface hero `h1` uses a bolder ad-hoc clamp (800 weight, `clamp(2.4rem,5.2vw,4rem)`) — a distinct, louder variant reserved for landing/pricing heroes, not app UI.
- **H2** (520, 24px, 1.2): section headings within a dashboard page.
- **H3** (600, 17px, 1.35): card/panel titles.
- **Body-lg** (18px, 1.6): lead paragraphs on Persuade surfaces.
- **Body** (16px, 1.6): default UI and copy text.
- **Meta** (13px, 1.5): timestamps, captions, table metadata.

### Named Rules
**The Two-Register Rule.** Marketing headlines are allowed to be loud (800 weight, large clamp); app UI headings are not. Don't borrow the landing `h1`/`h2` styles into dashboard pages, and don't soften a landing hero to match the app's quieter scale.

## Layout

Persuade surfaces use a max `1180px` container and generous `104px` vertical section padding (`72px` under 960px) — the rhythm of a marketing page meant to be scrolled through. Operate surfaces (dashboard, editor, tracker) are denser: components lean on the `Card` primitive's own `content` (20px) or `compact` (16px) padding rather than page-level section spacing, since the unit of layout is a panel or table row, not a full-bleed section.

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
- **Density:** `content` (20px padding) for profile/settings/review panels; `compact` (16px) for stat tiles and kanban cards — pick by content type, not by eyeballing spacing per instance.
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
