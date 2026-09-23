/** One look for every button in a bullet's floating toolbars: the structural FloatingToolbar
 * (drag/move/remove/AI-assist, in shared.tsx) and the selection-driven BulletFormatToolbar
 * (Bold/Italic). Pulled into its own leaf module, rather than defined in shared.tsx and imported
 * by BulletFormatToolbar, because shared.tsx renders BulletFormatToolbar - importing the other way
 * would be circular. */
export const FLOATING_TOOLBAR_BUTTON =
  "inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-1.5 text-xs font-semibold text-surface transition-colors duration-fast ease-editorial hover:bg-surface/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

export const FLOATING_TOOLBAR_TONE = {
  default: "",
  primary: "bg-accent hover:bg-accent-hover",
  danger: "hover:bg-critical",
} as const;
