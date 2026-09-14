import Link from "next/link";
import { GuardedLink } from "@/components/dashboard/GuardedLink";
import { LogoMark, LOGO_INK, LOGO_TERRACOTTA } from "@/components/marketing/LogoMark";
import { clsx } from "@/lib/utils";

export function Logo({
  href = "/",
  className,
  guarded = false,
  onClick,
}: {
  href?: string;
  className?: string;
  /**
   * Route through the unsaved-changes guard. Only meaningful (and only needed) where Logo
   * actually renders inside UnsavedChangesProvider - the dashboard chrome. Leave this off
   * everywhere else (marketing pages, error/not-found boundaries): GuardedLink's useRouter()
   * requires a real Next.js router context, which those pages don't always provide (e.g. in
   * isolated component tests), and there's nothing to guard there regardless.
   */
  guarded?: boolean;
  onClick?: () => void;
}) {
  const LinkComponent = guarded ? GuardedLink : Link;
  return (
    <LinkComponent
      href={href}
      onClick={onClick}
      className={clsx("inline-flex items-center gap-2.5", className)}
    >
      <LogoMark className="h-[38px] w-[38px] shrink-0 object-contain" />
      <span className="font-sans text-[23px] font-extrabold tracking-[-0.01em]">
        <span style={{ color: LOGO_INK }}>apply</span>
        <span style={{ color: LOGO_TERRACOTTA }}>lab</span>
      </span>
    </LinkComponent>
  );
}
