import { GeistSans } from "geist/font/sans";
import { Fraunces } from "next/font/google";

// The home dashboard and app sidebar use the reference design's type: Geist for UI text and
// Fraunces 600 for the welcome heading. Exposed as CSS variables (font-dash / font-dash-display).
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  // Variable font (opsz 9..144, like the reference's Google Fonts request); 600 is set in CSS.
  axes: ["opsz"],
  display: "swap",
});

export const dashboardFontVariables = `${GeistSans.variable} ${fraunces.variable}`;
