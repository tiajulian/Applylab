"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  UsersIcon,
  ClockIcon,
  TargetIcon,
  CheckIcon,
  XIcon,
} from "@/components/ui/icons/LucideIcons";

export interface GroupCoachingViewProps {
  onStartPractice: () => void;
}

export function GroupCoachingView({ onStartPractice }: GroupCoachingViewProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Badge variant="attention">Coached Mode</Badge>
          <Badge variant="neutral">Assessment Centre Prep</Badge>
        </div>
        <h2 className="mt-3 text-2xl font-display font-semibold text-ink">
          Group Exercise &amp; Assessment Centre Coaching
        </h2>
        <p className="mt-2 text-sm text-ink-secondary leading-relaxed">
          A 1:1 AI cannot honestly simulate real group multi-party dynamics. Instead, ApplyLab provides
          a dedicated coaching module on what real assessors evaluate, high-scoring contribution patterns,
          and how to lead without dominating.
        </p>
      </div>

      {/* 3 Key Dimensions Assessors Watch */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
            <UsersIcon className="w-5 h-5" strokeWidth={2.75} />
          </div>
          <h3 className="mt-3 font-semibold text-ink">1. Collaboration &amp; Inclusion</h3>
          <p className="mt-1 text-xs text-ink-secondary leading-relaxed">
            Assessors penalize candidates who speak over others. High scorers actively invite quiet
            peers: <em>&ldquo;Sarah, what do you think about this constraint?&rdquo;</em>
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ClockIcon className="w-5 h-5" strokeWidth={2.75} />
          </div>
          <h3 className="mt-3 font-semibold text-ink">2. Time &amp; Framework Discipline</h3>
          <p className="mt-1 text-xs text-ink-secondary leading-relaxed">
            Volunteering to track time or proposing an agreed decision structure (e.g. 5m reading,
            15m brainstorm, 10m synthesis) establishes calm leadership.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
            <TargetIcon className="w-5 h-5" strokeWidth={2.75} />
          </div>
          <h3 className="mt-3 font-semibold text-ink">3. Synthesis &amp; Consensus</h3>
          <p className="mt-1 text-xs text-ink-secondary leading-relaxed">
            Rather than repeating points, summarize competing views and bridge them: <em>&ldquo;It looks like
            we agree on X and Y, but need to decide on budget Z.&rdquo;</em>
          </p>
        </div>
      </div>

      {/* Practical Playbook */}
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h3 className="text-base font-semibold text-ink">The Assessment Centre Playbook</h3>
        <ul className="mt-4 space-y-3 text-sm text-ink-secondary">
          <li className="flex items-start gap-2.5">
            <CheckIcon className="w-4 h-4 text-success shrink-0 mt-0.5" strokeWidth={2.75} />
            <span><strong>Do:</strong> Anchor every proposal in the brief&apos;s commercial objective (e.g. &ldquo;Our mandate is customer retention...&rdquo;).</span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckIcon className="w-4 h-4 text-success shrink-0 mt-0.5" strokeWidth={2.75} />
            <span><strong>Do:</strong> Build constructively on ideas (&ldquo;Yes, and building on Tom&apos;s point, we could also...&rdquo;).</span>
          </li>
          <li className="flex items-start gap-2.5">
            <XIcon className="w-4 h-4 text-critical shrink-0 mt-0.5" strokeWidth={2.75} />
            <span><strong>Don&apos;t:</strong> Dominate airtime. 40% of the speaking time in a 4-person group is an immediate red flag.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <XIcon className="w-4 h-4 text-critical shrink-0 mt-0.5" strokeWidth={2.75} />
            <span><strong>Don&apos;t:</strong> Attack others&apos; suggestions. Pivot disagreements positively (&ldquo;That&apos;s a valid risk; what if we mitigated it with...&rdquo;).</span>
          </li>
        </ul>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-xs text-ink-muted">
            Ready to rehearse verbal synthesis and scenario framing?
          </span>
          <Button variant="primary" onClick={onStartPractice} className="rounded-pill">
            Start Group Practice Prompts
          </Button>
        </div>
      </div>
    </div>
  );
}

