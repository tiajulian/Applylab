import type { Metadata } from "next";
import { Newsreader, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

const title = "ApplyLab | AI Job-Search Copilot Built for Australia 🇦🇺";
const description =
  "From job ad to job offer. Understand your fit, tailor ATS-optimised resumes and cover letters, autofill applications across SEEK and Workday, and prepare for interviews, all powered by one verified career profile.";

export const metadata: Metadata = {
  metadataBase: new URL("https://applylab.io"),
  title,
  description,
  openGraph: {
    title,
    description,
    url: "https://applylab.io",
    siteName: "ApplyLab",
    locale: "en_AU",
    type: "website",
    images: ["/logo-icon.png"],
  },
  twitter: {
    card: "summary",
    title,
    description,
    images: ["/logo-icon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-AU"
      // Adds newsreader.className alongside .variable: next/font's docs say direct .className
      // usage (not just referencing .variable through a CSS custom property) is what's needed for
      // its automatic <link rel="preload"> to fire for a font. Flagging the honest state of this,
      // rather than asserting it's fixed: local `next build` + `next start` testing here still
      // shows no font preload link in the rendered <head> either way (checked both with and
      // without this line) - font-display:swap is confirmed active (44 generated @font-face
      // rules, 42 with font-display:swap - the other 2 are Next's own auto-generated
      // metrics-matched fallback faces, which don't carry it), so text is never invisible while
      // fonts load, but the preload gap itself is unresolved. This line is still correct per
      // Next's docs and harmless (every text-rendering element sets font-sans/font-display/
      // font-mono explicitly - see tailwind.config.ts - so this class's own font-family is always
      // overridden), so it's left in in case it behaves differently on the actual Vercel build/
      // CDN vs. this local test. Re-check the rendered <head> on a real deploy; if still missing,
      // preloading the specific hashed font URL would need to be read from the build output
      // rather than guessed, and even then may not be safely readable at runtime in a Vercel
      // serverless function (.next/static is typically CDN-hosted, not bundled with the function).
      className={`${newsreader.className} ${newsreader.variable} ${ibmPlexSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
