/** One look for every button in the editor toolbar, so the row reads as a set: same height, corners,
 * type and hover. Icons sit at the left, the label follows. */
export const TOOLBAR_SHAPE =
  "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

/** Colours, kept apart from the shape so a button with its own tone (the score) can swap them without a clash. */
export const TOOLBAR_NEUTRAL = "border-border/80 bg-paper/50 text-ink hover:border-accent hover:bg-paper-deep";

export const TOOLBAR_BUTTON = `${TOOLBAR_SHAPE} ${TOOLBAR_NEUTRAL}`;

export const TOOLBAR_ICON = "h-3.5 w-3.5 shrink-0";
