// Class lists for the home dashboard, translated value-for-value from the reference design's CSS
// (applylab-dashboard-reference.html). Each constant is named after the reference class it ports.

export const btn =
  "inline-flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-[18px] text-[14px] font-medium no-underline";
export const btnPrimary = `${btn} h-[52px] border-none bg-dash-orange-ink px-6 text-[16px] text-white hover:bg-dash-orange-deep hover:text-white`;
/** The reference's step 1 "Start": primary colours at outline size. */
export const btnPrimarySmall = `${btn} border-none bg-dash-orange-ink text-white hover:bg-dash-orange-deep hover:text-white`;
export const btnOutline = `${btn} border border-dash-input bg-white text-dash-text hover:border-dash-text-2 hover:text-dash-text disabled:cursor-default disabled:opacity-60`;
export const btnText = `${btn} border-none bg-transparent px-2 text-dash-orange-ink hover:text-dash-orange-deep`;
export const textLink =
  "rounded-lg text-[15px] font-medium text-dash-text underline decoration-[#F0B48F] underline-offset-4 hover:text-dash-text";

export const sectionHead = "mb-3 flex items-center justify-between gap-3";
export const sectionTitle = "flex items-center gap-2 text-[18px] font-semibold";
export const sectionLink = "rounded-lg text-[14px] font-medium text-dash-orange-ink no-underline hover:text-dash-orange-deep";
export const countBadge =
  "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-dash-orange px-1.5 text-[12px] font-semibold text-white";

/** .card, with the reference's `.row + .row` divider. */
export const card = "divide-y divide-dash-divider overflow-hidden rounded-2xl border border-dash-border bg-white";
/** .row without its vertical alignment, for .row-top (icon pinned to the top of a tall row). */
export const rowBase = "flex gap-4 px-5 py-[18px] max-md:flex-wrap";
export const row = `${rowBase} items-center`;
export const rowBody = "min-w-0 flex-1";
export const rowTitle = "text-[16px] font-semibold";
export const rowSub = "mt-1 text-[14px] text-dash-muted";
export const rowIcon = "flex h-10 w-10 flex-none items-center justify-center rounded-full [&>svg]:h-[18px] [&>svg]:w-[18px]";
export const iconBlue = "bg-[#EFF6FF] text-[#1D4ED8]";
export const iconOrange = "bg-[#FFF1E8] text-dash-orange-ink";
export const iconGreen = "bg-[#DCFCE7] text-[#15803D]";
