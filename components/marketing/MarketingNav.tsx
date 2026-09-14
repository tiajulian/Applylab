"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        // Remove focus from any active element inside nav
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };

    const handleResize = () => {
      if (window.innerWidth > 960) {
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Body scroll lock on mobile
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleLinkClick = () => {
    setMobileOpen(false);
  };

  return (
    <>
      <div id="top-sentinel" aria-hidden="true" />
      <header id="site-header">
        <div className="container nav">
          <Logo onClick={handleLinkClick} />

          <nav
            className={`nav-links ${mobileOpen ? "mobile-open" : ""}`}
            aria-label="Primary navigation"
          >
            {/* Mega Dropdown 1: Resume */}
            <div className="nav-item">
              <button
                className="nav-trigger"
                type="button"
                aria-haspopup="true"
                aria-expanded="false"
              >
                Resume <span className="caret">⌄</span>
              </button>
              <div className="mega">
                <div className="mega-col">
                  <span className="mega-head">Build</span>
                  <a
                    className="mega-link"
                    href="#score"
                    onClick={handleLinkClick}
                  >
                    <b>Free Resume Score</b>
                    <small>See how Australian ATS parsers read it</small>
                  </a>
                  <a
                    className="mega-link"
                    href="#traceable"
                    onClick={handleLinkClick}
                  >
                    <b>Traceable Resume</b>
                    <small>Every line tied to verified evidence</small>
                  </a>
                </div>
                <div className="mega-col">
                  <span className="mega-head">Templates &amp; fit</span>
                  <a
                    className="mega-link"
                    href="#templates"
                    onClick={handleLinkClick}
                  >
                    <b>ATS Templates</b>
                    <small>Eight strict 1-page AU layouts</small>
                  </a>
                  <a
                    className="mega-link"
                    href="#why"
                    onClick={handleLinkClick}
                  >
                    <b>The Australian Edge</b>
                    <small>Built for how Australia hires</small>
                  </a>
                </div>
              </div>
            </div>

            {/* Mega Dropdown 2: Job search */}
            <div className="nav-item">
              <button
                className="nav-trigger"
                type="button"
                aria-haspopup="true"
                aria-expanded="false"
              >
                Job search <span className="caret">⌄</span>
              </button>
              <div className="mega">
                <div className="mega-col">
                  <span className="mega-head">Apply</span>
                  <a
                    className="mega-link"
                    href="#extension"
                    onClick={handleLinkClick}
                  >
                    <b>Chrome Extension</b>
                    <small>1-click autofill on SEEK &amp; Workday</small>
                  </a>
                  <a
                    className="mega-link"
                    href="#cover-letters"
                    onClick={handleLinkClick}
                  >
                    <b>Cover Letters</b>
                    <small>From the same verified evidence chain</small>
                  </a>
                  <a
                    className="mega-link"
                    href="#tracker"
                    onClick={handleLinkClick}
                  >
                    <b>Application Tracker</b>
                    <small>Kanban board, applied to offer</small>
                  </a>
                </div>
                <div className="mega-col">
                  <span className="mega-head">Prepare</span>
                  <a
                    className="mega-link"
                    href="#interview"
                    onClick={handleLinkClick}
                  >
                    <b>AI Interview Coach</b>
                    <small>STAR scorecard, voice or text</small>
                  </a>
                  <a
                    className="mega-link"
                    href="#how"
                    onClick={handleLinkClick}
                  >
                    <b>How It Works</b>
                    <small>Three steps to a defensible application</small>
                  </a>
                </div>
              </div>
            </div>

            <a className="nav-flat" href="#pricing" onClick={handleLinkClick}>
              Pricing
            </a>
            <a className="nav-flat" href="#faq" onClick={handleLinkClick}>
              FAQ
            </a>
          </nav>

          <div className="nav-cta">
            <Link className="signin" href="/login">
              Sign in
            </Link>
            <a className="btn btn-primary btn-sm" href="#score">
              Get started
            </a>
            <button
              className="burger"
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
