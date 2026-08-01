import { HTMLAttributes } from "react";
import { clsx } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded border border-border bg-surface p-6",
        className
      )}
      {...props}
    />
  );
}
