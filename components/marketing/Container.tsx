import { HTMLAttributes } from "react";
import { clsx } from "@/lib/utils";

export function Container({
  className,
  size = "5xl",
  ...props
}: HTMLAttributes<HTMLDivElement> & { size?: "3xl" | "4xl" | "5xl" | "6xl" }) {
  const maxWidth = {
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
  }[size];

  return <div className={clsx("mx-auto px-4", maxWidth, className)} {...props} />;
}
