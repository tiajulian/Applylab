import Link from "next/link";
import { LogoMark, LOGO_INK, LOGO_TERRACOTTA } from "@/components/marketing/LogoMark";
import { clsx } from "@/lib/utils";

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={clsx("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="h-[38px] w-[38px] shrink-0" />
      <span className="font-display text-[23px] font-semibold tracking-[-0.01em]">
        <span style={{ color: LOGO_INK }}>apply</span>
        <span style={{ color: LOGO_TERRACOTTA }}>lab</span>
      </span>
    </Link>
  );
}
