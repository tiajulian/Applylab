"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useUnsavedChangesGuard } from "@/components/dashboard/UnsavedChangesProvider";

// href is narrowed to string (unlike LinkProps, which also allows UrlObject) because
// next/navigation's router.push() in the App Router only accepts a string.
type GuardedLinkProps = Omit<LinkProps, "href"> &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    href: string;
    children: ReactNode;
  };

/**
 * Drop-in replacement for next/link's Link that checks UnsavedChangesProvider before navigating.
 * Outside a provider (e.g. rendered on the public marketing site) it behaves exactly like Link,
 * since the context's default confirmLeave() always resolves true.
 */
export function GuardedLink({ href, onClick, ...props }: GuardedLinkProps) {
  const { confirmLeave } = useUnsavedChangesGuard();
  const router = useRouter();

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    // Modifier-key / non-primary clicks (open in new tab, etc.) navigate natively - nothing to guard.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    const canLeave = await confirmLeave();
    if (canLeave) router.push(href);
  }

  return <Link href={href} onClick={handleClick} {...props} />;
}
