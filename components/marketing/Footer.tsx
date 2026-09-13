"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="landing-foot">
      <div className="container foot">
        <div>
          <Link className="brand" href="/">
            <span className="mark">A</span>
            ApplyLab
          </Link>
          <p>
            <small>&copy; {new Date().getFullYear()} &middot; The Australian job-search copilot 🇦🇺</small>
          </p>
        </div>
        <nav className="foot-links" aria-label="Footer navigation">
          <Link href="/resume-score">Free Resume Score</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="mailto:support@applylab.au">Contact</a>
        </nav>
      </div>
    </footer>
  );
}
