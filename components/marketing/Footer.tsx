"use client";

import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";

export function Footer() {
  return (
    <footer className="landing-foot">
      <div className="container foot">
        <div>
          <Logo className="mb-2" />
          <p>
            <small>&copy; {new Date().getFullYear()} &middot; The Australian job-search copilot 🇦🇺</small>
          </p>
        </div>
        <nav className="foot-links" aria-label="Footer navigation">
          <Link href="/resume-score">Free Resume Score</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="mailto:applylab.support@gmail.com">Contact</a>
        </nav>
      </div>
    </footer>
  );
}
