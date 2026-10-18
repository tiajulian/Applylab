export const EASE = [0.2, 0.8, 0.2, 1] as const;

/** exit= for a modal's outer wrapper: stops it catching clicks the moment it starts closing, so the
 * first click after closing reaches the page instead of the fading overlay. */
export const PASS_THROUGH_ON_EXIT = { pointerEvents: "none" } as const;
