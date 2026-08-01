import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";

const FEATURES = [
  {
    title: "Built for SEEK, PageUp & Workday",
    description:
      "Single-column, ATS-safe formatting that parses cleanly: no tables, no graphics, no columns.",
  },
  {
    title: "Tailored to every job ad",
    description:
      "Paste a job description and we rewrite your resume to mirror its keywords and requirements.",
  },
  {
    title: "Australian by default",
    description:
      "Australian English spelling, A4 layout, work rights line, and a full referees section, every time.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="font-display text-lg font-medium text-ink">applylab</span>
          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/login"
              className="group relative text-ink-secondary transition-colors duration-fast ease-editorial hover:text-ink"
            >
              Log in
              <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent transition-all duration ease-editorial group-hover:w-full" />
            </Link>
            <Link href="/signup">
              <Button size="sm">Sign up free</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center">
          <Reveal>
            <h1 className="font-display text-display text-ink">
              AI resumes built for the Australian job market
            </h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-5 max-w-2xl text-body-lg text-ink-secondary">
              applylab turns any job ad into an ATS-optimised, SEEK-ready resume and cover letter,
              with the Australian formatting recruiters expect, in minutes.
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="mt-8 flex gap-3">
              <Link href="/signup">
                <Button size="lg">Build your resume free</Button>
              </Link>
              <Link href="/upgrade">
                <Button size="lg" variant="secondary">
                  See pricing
                </Button>
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-4 text-sm text-ink-muted">
              No credit card required for your first 2 resumes.
            </p>
          </Reveal>
        </section>

        <section className="border-t border-border bg-paper-deep">
          <StaggerList className="mx-auto grid max-w-5xl gap-8 px-4 py-20 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <StaggerItem key={feature.title} className="flex flex-col gap-2">
                <h2 className="text-h3 font-display text-ink">{feature.title}</h2>
                <p className="text-sm text-ink-secondary">{feature.description}</p>
              </StaggerItem>
            ))}
          </StaggerList>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-20 text-center">
          <Reveal>
            <h2 className="font-display text-h2 text-ink">Simple, Australian-dollar pricing</h2>
            <p className="mt-2 text-ink-secondary">
              Start free. Upgrade when you need unlimited resumes.
            </p>
            <Link href="/upgrade" className="mt-6 inline-block">
              <Button>View plans</Button>
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-ink-muted">
        © {new Date().getFullYear()} applylab. Made for the Australian job market.
      </footer>
    </div>
  );
}
