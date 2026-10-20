"use client";

import { useState, useEffect, type FocusEvent } from "react";
import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { ChevronDownIcon } from "@/components/ui/icons/LucideIcons";

// Every href is a home page section that always renders (#stories only renders with enough real
// quotes, so it isn't linked here).
const MEGA_COLUMNS = [
  {
    head: "Check and fix",
    links: [
      { href: "#score", title: "Free resume score", note: "See how strong your resume is" },
      { href: "#how", title: "How it works", note: "From job ad to tailored resume" },
      { href: "#stand-out", title: "Stand out", note: "Show what you achieved, not just what you did" },
    ],
  },
  {
    head: "Prepare and choose",
    links: [
      { href: "#interview", title: "Interview practice", note: "Rehearse out loud, get feedback" },
      { href: "#templates", title: "Resume templates", note: "Eight 1-page Australian layouts" },
      { href: "#faq", title: "FAQ", note: "Extension, interview practice and your data" },
    ],
  },
];

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Hover and focus-within tracked separately (not one combined boolean): the CSS trigger is
  // :hover OR :focus-within, and collapsing both into a single flag let onMouseLeave clear it
  // while focus was still inside the panel, reporting aria-expanded="false" on a menu the CSS
  // was still showing.
  const [megaHover, setMegaHover] = useState(false);
  const [megaFocus, setMegaFocus] = useState(false);

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
            {/* Mega dropdown: items follow the page order */}
            <div className="nav-item" {...megaHandlers(setMegaHover, setMegaFocus)}>
              <button
                className="nav-trigger"
                type="button"
                aria-haspopup="true"
                aria-expanded={megaHover || megaFocus}
              >
                Product{" "}
                <span className="caret" aria-hidden="true">
                  <ChevronDownIcon className="h-3.5 w-3.5" />
                </span>
              </button>
              <div className="mega">
                {MEGA_COLUMNS.map((col) => (
                  <div className="mega-col" key={col.head}>
                    <span className="mega-head">{col.head}</span>
                    {col.links.map((link) => (
                      <a key={link.href} className="mega-link" href={link.href} onClick={handleLinkClick}>
                        <b>{link.title}</b>
                        <small>{link.note}</small>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <a className="nav-flat" href="#interview" onClick={handleLinkClick}>
              Interview practice
            </a>
            <a className="nav-flat" href="#pricing" onClick={handleLinkClick}>
              Pricing
            </a>
            <Link className="nav-flat" href="/blog" onClick={handleLinkClick}>
              Learn
            </Link>
            <Link className="nav-flat nav-mobile-only" href="/login" onClick={handleLinkClick}>
              Sign in
            </Link>
          </nav>

          <div className="nav-cta">
            <Link className="signin" href="/login">
              Sign in
            </Link>
            <Link className="btn btn-primary btn-sm" href="/onboarding" data-cta="nav-start-free">
              Start free
            </Link>
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
