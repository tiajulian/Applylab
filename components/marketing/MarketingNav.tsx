"use client";

import { useState, useEffect, type FocusEvent } from "react";
import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Hover and focus-within tracked separately (not one combined boolean): the CSS trigger is
  // :hover OR :focus-within, and collapsing both into a single flag let onMouseLeave clear it
  // while focus was still inside the panel, reporting aria-expanded="false" on a menu the CSS
  // was still showing.
  const [resumeHover, setResumeHover] = useState(false);
  const [resumeFocus, setResumeFocus] = useState(false);
  const [jobSearchHover, setJobSearchHover] = useState(false);
  const [jobSearchFocus, setJobSearchFocus] = useState(false);

  // A tap fires mouseenter with no matching mouseleave, so hover state can get stuck "true" on
  // touch devices at desktop widths (e.g. an iPad in landscape). Skip hover tracking there;
  // aria-expanded still tracks real focus/blur from the tap, which doesn't get stuck.
  const [supportsHover, setSupportsHover] = useState(true);
  useEffect(() => {
    setSupportsHover(window.matchMedia("(hover: hover)").matches);
  }, []);

  const megaHandlers = (setHover: (v: boolean) => void, setFocus: (v: boolean) => void) => ({
    onMouseEnter: () => supportsHover && setHover(true),
    onMouseLeave: () => supportsHover && setHover(false),
    onFocus: () => setFocus(true),
    onBlur: (e: FocusEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocus(false);
    },
  });

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
            <div className="nav-item" {...megaHandlers(setResumeHover, setResumeFocus)}>
              <button
                className="nav-trigger"
                type="button"
                aria-haspopup="true"
                aria-expanded={resumeHover || resumeFocus}
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
            <div className="nav-item" {...megaHandlers(setJobSearchHover, setJobSearchFocus)}>
              <button
                className="nav-trigger"
                type="button"
                aria-haspopup="true"
                aria-expanded={jobSearchHover || jobSearchFocus}
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
