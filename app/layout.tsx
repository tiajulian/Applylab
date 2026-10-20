import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Newsreader, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import { BRAND } from "@/lib/marketing/copy";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans-alt",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

const title = `ApplyLab | ${BRAND.seoTagline}`;
const description =
  "Paste a SEEK or LinkedIn job ad. ApplyLab tailors your resume using only your real experience, then helps you practise the interview out loud. Free to start.";

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
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${newsreader.variable} ${ibmPlexSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: 'document.documentElement.classList.add("js");',
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

