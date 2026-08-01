"use client";

import { useState } from "react";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";

export function SkillChips({
  skills,
  onChange,
}: {
  skills: string[];
  onChange: (skills: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function addSkill() {
    const value = draft.trim();
    if (!value) return;
    if (!skills.includes(value)) {
      onChange([...skills, value]);
    }
    setDraft("");
  }

  function removeSkill(skill: string) {
    onChange(skills.filter((s) => s !== skill));
  }

  return (
    <div className="flex flex-col gap-2">
      <StaggerList className="flex flex-wrap gap-2">
        {skills.map((skill) => (
          <StaggerItem key={skill}>
            <span className="flex items-center gap-1.5 rounded-pill bg-accent-soft px-3 py-1 text-sm text-accent">
              {skill}
              <button
                type="button"
                className="text-accent/60 transition-colors duration-fast ease-editorial hover:text-critical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => removeSkill(skill)}
                aria-label={`Remove ${skill}`}
              >
                ×
              </button>
            </span>
          </StaggerItem>
        ))}
      </StaggerList>
      <input
        type="text"
        value={draft}
        placeholder="Type a skill and press Enter"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addSkill();
          }
        }}
        onBlur={addSkill}
        className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] duration-fast ease-editorial focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
