"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ChipPicker } from "@/components/profile/ChipPicker";
import { ImpactField } from "@/components/profile/ImpactField";
import { GuidedProjectBuilderModal } from "@/components/profile/GuidedProjectBuilderModal";
import type { ProjectEntry } from "@/types";

const POPULAR_STACK_SUGGESTIONS = [
  "Python",
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "PostgreSQL",
  "Snowflake",
  "Kafka",
  "AWS",
  "Docker",
  "TailwindCSS",
];

interface ProjectCardProps {
  entry: ProjectEntry;
  index: number;
  onUpdate: (patch: Partial<ProjectEntry>) => void;
  onRemove: () => void;
  messagesFor?: (field: string) => React.ReactNode;
}

export function ProjectCard({
  entry,
  index,
  onUpdate,
  onRemove,
  messagesFor,
}: ProjectCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [autoRunInstant, setAutoRunInstant] = useState(false);

  function handleToggleTool(tool: string) {
    const current = entry.tools || [];
    if (current.includes(tool)) {
      onUpdate({ tools: current.filter((t) => t !== tool) });
    } else {
      onUpdate({ tools: [...current, tool] });
    }
  }

  function handleAddCustomTool(tool: string) {
    const current = entry.tools || [];
    if (!current.includes(tool)) {
      onUpdate({ tools: [...current, tool] });
    }
  }

  function openInstantEnhance() {
    setAutoRunInstant(true);
    setIsModalOpen(true);
  }

  function openGuidedBuilder() {
    setAutoRunInstant(false);
    setIsModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-paper p-5 shadow-sm transition-shadow hover:shadow-pop">
      {messagesFor && messagesFor(`projects.${index}`)}

      {/* Header Bar with Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3 gap-3">
        <div className="flex items-center gap-2">
          <span className="font-display text-base font-bold text-ink">
            {entry.title || `Project #${index + 1}`}
          </span>
          {entry.link && (
            <a
              href={entry.link.startsWith("http") ? entry.link : `https://${entry.link}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded bg-paper-deep px-2 py-0.5 text-xs text-accent hover:underline font-semibold"
              title="Open Live Preview / GitHub"
            >
              <span>🔗 Preview</span>
              <span className="text-[10px]">&rarr;</span>
            </a>
          )}
        </div>

        {/* Action Buttons: Instant AI Polish & Guided Builder */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openInstantEnhance}
            disabled={!entry.title.trim()}
            title="Enhance description using existing fields in 1 click"
            className="border-accent/40 bg-accent-soft/30 text-accent hover:bg-accent-soft"
          >
            ✨ Enhance Project with AI
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={openGuidedBuilder}
            disabled={!entry.title.trim()}
            title="Launch 4-step P-A-C-E Guided Project Builder"
          >
            💡 Guided Project Builder
          </Button>
        </div>
      </div>

      {/* Core Project Form Fields */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Project Name (required)"
          placeholder="e.g. Distributed Telemetry Pipeline"
          required
          value={entry.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
        />

        <Input
          label="Role / Contribution (optional)"
          placeholder="e.g. Lead Architect, Data Engineer, Solo Creator"
          value={entry.context}
          onChange={(e) => onUpdate({ context: e.target.value })}
        />

        <Input
          label="Timeframe / Status (optional)"
          placeholder="e.g. 2024 – Present, 3-month project"
          value={entry.timeframe}
          onChange={(e) => onUpdate({ timeframe: e.target.value })}
        />

        <div className="flex flex-col gap-1.5">
          <Input
            label="Live Demo / GitHub Link (optional)"
            placeholder="e.g. github.com/username/project or demo.com"
            value={entry.link}
            onChange={(e) => onUpdate({ link: e.target.value })}
          />
        </div>
      </div>

      {/* Stack & Technologies Chip Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          Technologies &amp; Stack:
        </label>
        <ChipPicker
          options={Array.from(new Set([...POPULAR_STACK_SUGGESTIONS, ...(entry.tools || [])]))}
          selected={entry.tools || []}
          onToggle={handleToggleTool}
          onAddNew={handleAddCustomTool}
          addPlaceholder="Add technology (e.g. AWS, Redis...)"
        />
      </div>

      {/* Description & Bullets */}
      <Textarea
        label="Project Description & Bullets"
        placeholder="Describe what it was, architectural choices, or bullets (or use AI buttons above to generate recruiter bullets)..."
        rows={4}
        value={entry.description}
        onChange={(e) => onUpdate({ description: e.target.value })}
      />

      {/* Impact & Outcome */}
      <ImpactField
        label="Outcome / Technical Metric (optional)"
        description="In your own words, e.g. sub-200ms latency or 500+ active users."
        textValue={entry.outcome}
        onTextChange={(value) => onUpdate({ outcome: value })}
        metricValue={entry.outcome_metric}
        onMetricChange={(value) => onUpdate({ outcome_metric: value })}
      />

      {/* Remove Button */}
      <div className="flex justify-between items-center border-t border-border/60 pt-3 mt-1">
        <button
          type="button"
          className="text-xs text-critical hover:underline"
          onClick={onRemove}
        >
          Remove project
        </button>
        <span className="text-[11px] text-ink-muted">
          P-A-C-E Framework Enabled
        </span>
      </div>

      {/* Guided Project Builder Modal */}
      <GuidedProjectBuilderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        project={entry}
        autoRunInstant={autoRunInstant}
        onApply={(enhanced) => {
          onUpdate({
            description: enhanced.description,
            ...(enhanced.outcome ? { outcome: enhanced.outcome } : {}),
            ...(enhanced.outcome_metric ? { outcome_metric: enhanced.outcome_metric } : {}),
          });
        }}
      />
    </div>
  );
}
