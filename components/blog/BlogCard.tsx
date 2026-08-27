import Link from "next/link";
import { BlogPost } from "@/lib/blog/types";
import { Badge } from "@/components/ui/Badge";
import { ClockIcon } from "@/components/ui/icons/LucideIcons";

interface BlogCardProps {
  post: BlogPost;
  variant?: "default" | "compact" | "featured";
}

export function BlogCard({ post, variant = "default" }: BlogCardProps) {
  const formattedDate = new Date(post.publishedAt).toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (variant === "featured") {
    return (
      <article className="group relative overflow-hidden rounded-2xl border border-accent/30 bg-surface p-6 sm:p-8 shadow-sm transition-all duration-slow ease-editorial hover:border-accent hover:shadow-pop">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 lg:items-center justify-between">
          <div className="space-y-4 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-on-accent shadow-sm">
                ⭐ Featured Guide
              </span>
              <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                {post.categoryLabel}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted">
                <ClockIcon className="h-3.5 w-3.5" />
                {post.readingTimeMinutes} min read
              </span>
            </div>

            <h2 className="font-display text-2xl sm:text-3xl lg:text-[34px] text-ink leading-tight group-hover:text-accent transition-colors duration-fast">
              <Link href={`/blog/${post.slug}`} className="focus:outline-none">
                <span className="absolute inset-0" aria-hidden="true" />
                {post.title}
              </Link>
            </h2>

            <p className="text-body text-ink-secondary line-clamp-3">
              {post.subtitle}
            </p>

            <div className="flex items-center gap-3 pt-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-deep text-xs font-bold text-ink border border-border">
                {post.author.initials}
              </div>
              <div className="text-xs">
                <p className="font-bold text-ink">{post.author.name}</p>
                <p className="text-ink-muted">{formattedDate} &middot; {post.author.role}</p>
              </div>
            </div>
          </div>

          <div className="lg:w-72 shrink-0 rounded-xl bg-paper p-5 border border-border/80 flex flex-col justify-between space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-accent mb-2">
                Key Takeaways
              </p>
              <ul className="space-y-2 text-xs text-ink-secondary">
                {post.keyTakeaways.slice(0, 3).map((takeaway, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-accent font-bold mt-0.5">&bull;</span>
                    <span className="line-clamp-2">{takeaway}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-bold text-accent group-hover:translate-x-1 transition-transform duration-fast">
              <span>Read Full Guide</span>
              <span>&rarr;</span>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface p-5 sm:p-6 transition-all duration-slow ease-editorial hover:border-accent/40 hover:shadow-pop">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="neutral" className="text-[11px] font-semibold">
            {post.categoryLabel}
          </Badge>
          <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
            <ClockIcon className="h-3 w-3" />
            {post.readingTimeMinutes} min
          </span>
        </div>

        <h3 className="font-display text-lg sm:text-xl text-ink leading-snug group-hover:text-accent transition-colors duration-fast">
          <Link href={`/blog/${post.slug}`} className="focus:outline-none">
            <span className="absolute inset-0" aria-hidden="true" />
            {post.title}
          </Link>
        </h3>

        <p className="text-sm text-ink-secondary line-clamp-3 leading-relaxed">
          {post.subtitle}
        </p>
      </div>

      <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-paper-deep text-[11px] font-bold text-ink border border-border">
            {post.author.initials}
          </div>
          <div className="text-[11px]">
            <span className="font-bold text-ink block">{post.author.name}</span>
            <span className="text-ink-muted">{formattedDate}</span>
          </div>
        </div>

        <span className="font-semibold text-accent group-hover:translate-x-1 transition-transform duration-fast inline-flex items-center gap-1">
          Read &rarr;
        </span>
      </div>
    </article>
  );
}
