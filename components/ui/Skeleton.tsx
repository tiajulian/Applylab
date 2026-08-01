import { HTMLAttributes } from "react";
import { clsx } from "@/lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("skeleton-shimmer rounded", className)}
      aria-hidden="true"
      {...props}
    />
  );
}
