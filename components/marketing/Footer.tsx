"use client";

import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { BRAND } from "@/lib/marketing/copy";

/** The one footer for every marketing page (home, pricing, resume score, blog, privacy). */
export function Footer() {
  return (
    <footer className="landing-foot" id="contact">
      <div className="container foot">
        <div>
          <Logo className="mb-2" />
          <p>
            <small>&copy; {new Date().getFullYear()} &middot; {BRAND.footerTagline}</small>
          </p>
        </div>
        <nav className="foot-links" aria-label="Footer navigation">
          <Link href="/#how">How it works</Link>
          <Link href="/resume-score">Free resume score</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href={`mailto:${BRAND.supportEmail}`}>Contact</a>
        </nav>
      </div>
    </footer>
  );
}
