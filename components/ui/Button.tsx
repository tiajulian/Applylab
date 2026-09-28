import { ButtonHTMLAttributes, forwardRef } from "react";
import Link from "next/link";
import { clsx } from "@/lib/utils";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  href?: string;
  target?: string;
  rel?: string;
}

export const VARIANT_STYLES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  // bg-accent-hover, not bg-accent: white text on the base accent only hits 3.6:1
  // (needs 4.5:1). accent-hover is the same orange family but dark enough to clear AA.
  // hover:brightness-95, not a third accent shade: the token scale has no color darker than
  // accent-hover, so the hover cue darkens via filter instead of swapping to a new named color.
  primary: "bg-accent-hover text-on-accent shadow-sm hover:brightness-95",
  secondary:
    "bg-transparent border border-border-strong text-ink hover:bg-paper-deep",
  outline:
    "bg-transparent border border-border-strong text-ink hover:bg-paper-deep",
  ghost: "text-accent hover:bg-accent-soft",
};

export const SIZE_STYLES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading,
      disabled,
      href,
      type = "button",
      target,
      rel,
      children,
      ...props
    },
    ref
  ) => {
    // Two different states, two different data attributes - neither maps cleanly onto the
    // native :disabled pseudo-class, which only matches <button> (never the href/<a> path) and
    // can't distinguish "blocked" from "loading":
    // - data-inert: not interactive right now, for either reason. Drives cursor/hover-lift
    //   suppression only, on both the <button> and <a> render paths.
    // - data-disabled: blocked (not loading). Drives the neutral-gray color swap - isLoading
    //   is excluded so an in-flight primary button keeps its brand color instead of flattening
    //   to gray mid-request.
    const isInert = Boolean(disabled) || Boolean(isLoading);
    const isBlockingDisabled = Boolean(disabled) && !isLoading;
    const combinedClassName = clsx(
      "inline-flex items-center justify-center gap-2 rounded-pill font-medium cursor-pointer",
      "transition-[background-color,color,transform,opacity,box-shadow,filter] duration-fast ease-editorial",
      "hover:-translate-y-px active:translate-y-px",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
      "data-[inert=true]:cursor-not-allowed data-[inert=true]:hover:translate-y-0 data-[inert=true]:active:translate-y-0",
      // Opaque neutral swap, not opacity-50: halving opacity on a colored (primary) button
      // crushed contrast to ~1.3:1. bg-paper-deep/text-ink-secondary clears 4.5:1 regardless of variant.
      "data-[disabled=true]:bg-paper-deep data-[disabled=true]:text-ink-secondary data-[disabled=true]:border-transparent data-[disabled=true]:shadow-none",
      VARIANT_STYLES[variant],
      SIZE_STYLES[size],
      className
    );

    const spinner = isLoading && (
      <svg
        className="h-4 w-4 animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    );

    if (href) {
      return (
        <Link
          {...(props as any)}
          href={href}
          target={target}
          rel={rel}
          className={combinedClassName}
          aria-disabled={disabled || isLoading}
          data-inert={isInert || undefined}
          data-disabled={isBlockingDisabled || undefined}
          onClick={disabled || isLoading ? (e) => e.preventDefault() : props.onClick as any}
        >
          {spinner}
          {children}
        </Link>
      );
    }

    return (
      <button
        {...props}
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        data-inert={isInert || undefined}
        data-disabled={isBlockingDisabled || undefined}
        className={combinedClassName}
      >
        {spinner}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

