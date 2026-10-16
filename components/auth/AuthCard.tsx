import type { ReactNode } from "react";
import { Logo } from "@/components/marketing/Logo";
import { Reveal } from "@/components/ui/Reveal";

/** The centred card every sign-in page uses, with the logo above it as the way back home. */
export function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <Reveal className="flex w-full max-w-sm flex-col items-center gap-6">
        <Logo />
        <div className={`w-full rounded border border-border bg-surface p-8 ${className ?? ""}`}>{children}</div>
      </Reveal>
    </main>
  );
}
