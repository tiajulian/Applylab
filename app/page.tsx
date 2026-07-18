import Link from "next/link";
import { Button } from "@/components/ui/Button";

const FEATURES = [
  {
    title: "Built for SEEK, PageUp & Workday",
    description:
      "Single-column, ATS-safe formatting that parses cleanly — no tables, no graphics, no columns.",
  },
  {
    title: "Tailored to every job ad",
    description:
      "Paste a job description and we rewrite your resume to mirror its keywords and requirements.",
  },
  {
    title: "Australian by default",
    description:
      "Australian English spelling, A4 layout, work rights line, and a full referees section — every time.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="text-lg font-semibold text-gray-900">applylab</span>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-gray-600 hover:text-gray-900">
              Log in
            </Link>
            <Link href="/signup">
              <Button size="sm">Sign up free</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            AI resumes built for the Australian job market
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-gray-600">
            applylab turns any job ad into an ATS-optimised, SEEK-ready resume and cover letter —
            with the Australian formatting recruiters expect, in minutes.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/signup">
              <Button size="lg">Build your resume free</Button>
            </Link>
            <Link href="/upgrade">
              <Button size="lg" variant="outline">
                See pricing
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500">No credit card required for your first 2 resumes.</p>
        </section>

        <section className="border-t border-gray-200 bg-gray-50">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-20 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex flex-col gap-2">
                <h2 className="text-base font-semibold text-gray-900">{feature.title}</h2>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h2 className="text-2xl font-semibold text-gray-900">Simple, Australian-dollar pricing</h2>
          <p className="mt-2 text-gray-600">Start free. Upgrade when you need unlimited resumes.</p>
          <Link href="/upgrade" className="mt-6 inline-block">
            <Button>View plans</Button>
          </Link>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} applylab. Made for the Australian job market.
      </footer>
    </div>
  );
}
