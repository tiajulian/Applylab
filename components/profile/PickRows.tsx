"use client";

import { ChipPicker } from "@/components/profile/ChipPicker";
import { TOOL_CATALOG } from "@/lib/wins/toolCatalog";
import { addPick, pickOptions, togglePick } from "@/lib/profile/pickOptions";

export interface Picks {
  tools: string[];
  stakeholders: string[];
}

/**
 * The "Tools used" and "Who was it for?" chip rows for one line, task or skill: the AI's likely
 * picks (the candidate's own spelling first when it's on their profile), anything already picked,
 * and a "+ Other" chip. A row with nothing to offer isn't shown at all - so a line the AI judged
 * needs neither renders nothing.
 */
export function PickRows({
  suggestedTools,
  suggestedStakeholders,
  profileTools = [],
  profileStakeholders = [],
  value,
  onChange,
  alwaysShow = false,
}: {
  suggestedTools: string[];
  suggestedStakeholders: string[];
  profileTools?: string[];
  profileStakeholders?: string[];
  value: Picks;
  onChange: (change: (prev: Picks) => Picks) => void;
  /** Show both rows even with nothing to suggest (each is then just an "Other" field) - for forms
   * that are themselves the place to describe the work, where hiding the rows would leave nowhere
   * to name a tool or person. */
  alwaysShow?: boolean;
}) {
  const toolOptions = pickOptions(suggestedTools, profileTools, value.tools);
  const stakeholderOptions = pickOptions(suggestedStakeholders, profileStakeholders, value.stakeholders);
  const update = (field: keyof Picks, change: (list: string[]) => string[]) =>
    onChange((prev) => ({ ...prev, [field]: change(prev[field]) }));

  return (
    <>
      {(alwaysShow || toolOptions.length > 0) && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-secondary">Tools used</p>
          <ChipPicker
            options={toolOptions}
            selected={value.tools}
            onToggle={(v) => update("tools", (list) => togglePick(list, v))}
            onAddNew={(v) => update("tools", (list) => addPick(list, v))}
            addPlaceholder="Other, e.g. Salesforce"
            ariaLabel="Add another tool or system"
            suggestions={TOOL_CATALOG}
            compactAdd
          />
        </div>
      )}
      {(alwaysShow || stakeholderOptions.length > 0) && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-secondary">Who was it for?</p>
          <ChipPicker
            options={stakeholderOptions}
            selected={value.stakeholders}
            onToggle={(v) => update("stakeholders", (list) => togglePick(list, v))}
            onAddNew={(v) => update("stakeholders", (list) => addPick(list, v))}
            addPlaceholder="Other, e.g. Head of Sales"
            ariaLabel="Add who else it was for"
            suggestions={profileStakeholders}
            compactAdd
          />
        </div>
      )}
    </>
  );
}

/** True when PickRows would show at least one row. */
export function hasPickRows(suggestedTools: string[], suggestedStakeholders: string[], value: Picks): boolean {
  return suggestedTools.length + suggestedStakeholders.length + value.tools.length + value.stakeholders.length > 0;
}
