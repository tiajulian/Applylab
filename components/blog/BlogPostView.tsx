"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { BlogPost } from "@/lib/blog/types";
import { BlogHeader } from "./BlogHeader";
import { BlogCard } from "./BlogCard";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ClockIcon, CalendarIcon, SparklesIcon, CheckIcon } from "@/components/ui/icons/LucideIcons";
import type { UserMenuProps } from "@/components/dashboard/UserAvatarMenu";

interface BlogPostViewProps {
  post: BlogPost;
  relatedPosts: BlogPost[];
  user: UserMenuProps | null;
}

export function BlogPostView({ post, relatedPosts, user }: BlogPostViewProps) {
  const { showToast } = useToast();
  const [activeSection, setActiveSection] = useState<string>(
    post.tableOfContents[0]?.id || ""
  );
  const [copied, setCopied] = useState(false);

  const formattedDate = new Date(post.publishedAt).toLocaleDateString("en-AU", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const updatedDate = post.updatedAt
    ? new Date(post.updatedAt).toLocaleDateString("en-AU", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  // IntersectionObserver for Table of Contents scroll-spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry) {
          setActiveSection(visibleEntry.target.id);
        }
      },
      {
        rootMargin: "-15% 0px -60% 0px",
        threshold: 0,
      }
    );

    post.tableOfContents.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [post.tableOfContents]);

  const [currentUrl, setCurrentUrl] = useState<string>(
    `https://applylab.com.au/blog/${post.slug}`
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentUrl(window.location.href);
    }
  }, []);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -90;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      showToast("Link copied to clipboard!", "success");
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    currentUrl
  )}`;
  const xShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    post.title
  )}&url=${encodeURIComponent(currentUrl)}`;

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink selection:bg-accent-soft selection:text-accent">
      <BlogHeader user={user} />

      <main className="flex-1">
        {/* Breadcrumb Navigation & Article Header */}
        <div className="border-b border-border bg-surface/50 py-8 sm:py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-xs text-ink-muted mb-4">
              <Link href="/" className="hover:text-ink transition-colors">
                Home
              </Link>
              <span>/</span>
              <Link href="/blog" className="hover:text-ink transition-colors">
                Blog
              </Link>
              <span>/</span>
              <span className="text-ink font-semibold truncate max-w-[200px] sm:max-w-md">
                {post.title}
              </span>
            </nav>

            <div className="space-y-4 max-w-4xl">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 font-bold text-accent">
                  {post.categoryLabel}
                </span>
                <span className="inline-flex items-center gap-1 text-ink-secondary">
                  <ClockIcon className="h-3.5 w-3.5" />
                  {post.readingTimeMinutes} min read
                </span>
                <span className="inline-flex items-center gap-1 text-ink-secondary">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {formattedDate}
                </span>
                {updatedDate && (
                  <span className="text-ink-muted hidden sm:inline">
                    (Updated {updatedDate})
                  </span>
                )}
              </div>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-[44px] text-ink leading-[1.15]">
                {post.title}
              </h1>

              <p className="text-body sm:text-body-lg text-ink-secondary leading-relaxed">
                {post.subtitle}
              </p>

              {/* Author & Share Row */}
              <div className="pt-4 flex flex-wrap items-center justify-between gap-4 border-t border-border/80">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-deep text-sm font-bold text-ink border border-border">
                    {post.author.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink">{post.author.name}</p>
                    <p className="text-xs text-ink-muted">{post.author.role}</p>
                  </div>
                </div>

                {/* Share Actions */}
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="text-ink-muted mr-1 hidden sm:inline">Share:</span>
                  <a
                    href={linkedInShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-ink hover:border-accent/40 hover:text-accent transition-colors"
                  >
                    LinkedIn
                  </a>
                  <a
                    href={xShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-ink hover:border-accent/40 hover:text-accent transition-colors"
                  >
                    X (Twitter)
                  </a>
                  <button
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-ink hover:border-accent/40 hover:text-accent transition-colors"
                  >
                    {copied ? (
                      <>
                        <CheckIcon className="h-3.5 w-3.5 text-success" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <span>Copy Link</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Article & Table of Contents Grid */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
          <div className="grid gap-12 lg:grid-cols-12">
            {/* Left Column: Sticky Table of Contents & Quick Widget */}
            <aside className="lg:col-span-4 hidden lg:block">
              <div className="sticky top-24 space-y-6">
                {/* Table of Contents */}
                <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-3">
                    Table of Contents
                  </p>
                  <nav className="space-y-1 text-xs">
                    {post.tableOfContents.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => scrollToSection(item.id)}
                        className={`block w-full text-left px-3 py-2 rounded-lg font-medium transition-all duration-fast ${
                          activeSection === item.id
                            ? "bg-accent-soft text-accent font-bold border-l-2 border-accent"
                            : "text-ink-secondary hover:text-ink hover:bg-paper"
                        }`}
                      >
                        {item.title}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Key Takeaways Box */}
                <div className="rounded-xl border border-border bg-paper p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-accent mb-2.5 flex items-center gap-1.5">
                    <SparklesIcon className="h-3.5 w-3.5" />
                    Key Takeaways
                  </p>
                  <ul className="space-y-2 text-xs text-ink-secondary">
                    {post.keyTakeaways.map((takeaway, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-accent font-bold mt-0.5">&bull;</span>
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Sidebar Call to Action Card */}
                <div className="rounded-xl border border-accent/30 bg-accent-soft p-5 text-center space-y-3">
                  <p className="text-xs font-bold text-accent uppercase tracking-wider">
                    ⚡ ApplyLab Copilot
                  </p>
                  <h4 className="font-display text-base font-bold text-ink leading-snug">
                    Turn this guide into an ATS-ready resume
                  </h4>
                  <p className="text-xs text-ink-secondary">
                    Auto-tailor your resume bullets to Australian standards in 30 seconds.
                  </p>
                  <Link href="/onboarding" className="block">
                    <Button size="sm" className="w-full font-bold text-xs py-2">
                      Build 2 free resumes &rarr;
                    </Button>
                  </Link>
                </div>
              </div>
            </aside>

            {/* Right Column: Article Prose Content */}
            <article className="lg:col-span-8 max-w-none">
              {/* Mobile Table of Contents Dropdown */}
              <div className="mb-8 lg:hidden rounded-xl border border-border bg-surface p-4">
                <label
                  htmlFor="mobile-toc"
                  className="block text-xs font-bold uppercase tracking-wider text-ink-muted mb-2"
                >
                  Jump to Section
                </label>
                <select
                  id="mobile-toc"
                  value={activeSection}
                  onChange={(e) => scrollToSection(e.target.value)}
                  className="w-full rounded-lg border border-border bg-paper px-3 py-2 text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {post.tableOfContents.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rendered Markdown Body */}
              <div className="prose-editorial">
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => {
                      const text = (Array.isArray(children) ? children.join("") : String(children || "")).trim();
                      const matchedItem = post.tableOfContents.find(
                        (item) =>
                          item.title === text ||
                          text.includes(item.title.replace(/^\d+\.\s*/, "")) ||
                          item.title.includes(text.replace(/^\d+\.\s*/, ""))
                      );
                      const id = matchedItem ? matchedItem.id : text.toLowerCase().replace(/[^\w]+/g, "-");
                      return (
                        <h2
                          id={id}
                          className="mt-10 mb-4 font-display text-2xl sm:text-[28px] text-ink scroll-mt-24 border-b border-border pb-2"
                        >
                          {children}
                        </h2>
                      );
                    },
                    h3: ({ children }) => (
                      <h3 className="mt-8 mb-3 font-display text-xl text-ink font-semibold">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="mt-4 text-body text-ink-secondary leading-relaxed">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="mt-4 list-disc space-y-2 pl-6 text-body text-ink-secondary">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mt-4 list-decimal space-y-2 pl-6 text-body text-ink-secondary">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-body text-ink-secondary">{children}</li>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-bold text-ink">{children}</strong>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="my-6 rounded-r-xl border-l-4 border-accent bg-accent-soft p-4 sm:p-5 text-sm font-medium text-ink leading-relaxed">
                        {children}
                      </blockquote>
                    ),
                    code: ({ children, className }) => {
                      const isInline = !className;
                      if (isInline) {
                        return (
                          <code className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-xs text-accent font-semibold">
                            {children}
                          </code>
                        );
                      }
                      return (
                        <pre className="my-6 overflow-x-auto rounded-xl border border-border bg-paper-deep p-4 font-mono text-xs text-ink">
                          <code>{children}</code>
                        </pre>
                      );
                    },
                    table: ({ children }) => (
                      <div className="my-6 overflow-x-auto rounded-xl border border-border bg-surface">
                        <table className="w-full text-left text-sm text-ink border-collapse">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="border-b border-border bg-paper-deep font-bold">
                        {children}
                      </thead>
                    ),
                    tbody: ({ children }) => (
                      <tbody className="divide-y divide-border">{children}</tbody>
                    ),
                    tr: ({ children }) => <tr>{children}</tr>,
                    th: ({ children }) => <th className="p-3 font-bold">{children}</th>,
                    td: ({ children }) => (
                      <td className="p-3 text-ink-secondary">{children}</td>
                    ),
                    hr: () => <hr className="my-10 border-border" />,
                  }}
                >
                  {post.content}
                </ReactMarkdown>
              </div>

              {/* In-Article Conversion Card */}
              <div className="my-10 rounded-2xl border border-accent/40 bg-surface p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="space-y-2 max-w-md">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-accent uppercase tracking-wider">
                      ✨ Australia&apos;s #1 AI Job Copilot
                    </span>
                    <h3 className="font-display text-xl sm:text-2xl text-ink leading-tight">
                      Ready to apply with a 90%+ match score?
                    </h3>
                    <p className="text-xs sm:text-sm text-ink-secondary">
                      Upload your career history once. ApplyLab generates tailored A4 resumes, Australian cover letters, and mock interview practice.
                    </p>
                  </div>
                  <Link href="/onboarding" className="shrink-0">
                    <Button size="md" className="font-bold px-5 py-2.5">
                      Tailor resume free &rarr;
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Author Bio Box */}
              <div className="mt-12 rounded-xl border border-border bg-surface p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-bold text-accent border border-accent/20">
                  {post.author.initials}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    About the Author
                  </p>
                  <h4 className="font-display text-lg text-ink font-bold">
                    {post.author.name}
                  </h4>
                  <p className="text-xs font-semibold text-accent">{post.author.role}</p>
                  <p className="text-xs text-ink-secondary leading-relaxed pt-1">
                    {post.author.bio}
                  </p>
                </div>
              </div>

              {/* Tags */}
              <div className="mt-8 pt-6 border-t border-border flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-ink-muted mr-1">Tags:</span>
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-paper-deep px-2.5 py-1 text-xs font-medium text-ink-secondary"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </article>
          </div>
        </div>

        {/* Related Articles Section */}
        {relatedPosts.length > 0 && (
          <section className="border-t border-border bg-surface/50 py-12 sm:py-16">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-accent">
                    Continue Learning
                  </p>
                  <h2 className="font-display text-2xl sm:text-3xl text-ink">
                    Related Career Guides
                  </h2>
                </div>
                <Link
                  href="/blog"
                  className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1"
                >
                  View all guides &rarr;
                </Link>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {relatedPosts.map((relatedPost) => (
                  <BlogCard key={relatedPost.slug} post={relatedPost} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-8 text-xs text-ink-secondary">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row text-center sm:text-left">
          <p>© {new Date().getFullYear()} ApplyLab. All rights reserved. Built for Australian job seekers.</p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 font-medium">
            <Link href="/" className="hover:text-ink transition-colors">Home</Link>
            <Link href="/blog" className="text-accent font-bold transition-colors">Blog</Link>
            <Link href="/pricing" className="hover:text-ink transition-colors">Pricing</Link>
            <Link href="/privacy" className="hover:text-ink transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-ink transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
