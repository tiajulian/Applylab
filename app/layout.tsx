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
      className={`${newsreader.variable} ${ibmPlexSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
