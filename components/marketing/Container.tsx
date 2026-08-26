import { HTMLAttributes } from "react";
import { clsx } from "@/lib/utils";

export function Container({
  className,
  size = "marketing",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  size?: "3xl" | "4xl" | "5xl" | "6xl" | "marketing";
}) {
  const maxWidth = {
    "3xl": "max-w-3xl px-4 sm:px-6",
    "4xl": "max-w-4xl px-4 sm:px-6",
    "5xl": "max-w-5xl px-4 sm:px-6",
    "6xl": "max-w-6xl px-5 sm:px-8",
    marketing: "max-w-[1140px] px-5 sm:px-8",
  }[size];

  return <div className={clsx("mx-auto", maxWidth, className)} {...props} />;
}
