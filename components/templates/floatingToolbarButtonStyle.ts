/** One look for every button in a bullet's floating toolbars: the structural FloatingToolbar
 * (drag/move/remove/AI-assist, in shared.tsx) and the selection-driven BulletFormatToolbar
 * (Bold/Italic). Pulled into its own leaf module, rather than defined in shared.tsx and imported
 * by BulletFormatToolbar, because shared.tsx renders BulletFormatToolbar - importing the other way
 * would be circular. */
const BUTTON_BASE =
  "inline-flex h-7 min-w-7 shrink-0 select-none items-center justify-center gap-1 whitespace-nowrap rounded-md px-1.5 text-xs font-semibold transition-colors duration-fast ease-editorial focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

export const FLOATING_TOOLBAR_BUTTON =
  `${BUTTON_BASE} text-surface hover:bg-surface/15 focus-visible:ring-surface`;

// Item controls sit on a light surface; the formatting and bullet toolbars keep their dark palette.
export const FLOATING_TOOLBAR_LIGHT_BUTTON = `${BUTTON_BASE} focus-visible:ring-accent`;

export const FLOATING_TOOLBAR_TONE = {
  default: "",
  primary: "bg-accent hover:bg-accent-hover",
  danger: "hover:bg-critical",
} as const;
