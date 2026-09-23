import { moveItem, DEFAULT_RESUME_SECTION_ORDER } from "@/lib/resume/resumeSections";
import type { EditorSnapshot, ResumeCommand } from "@/lib/resume/resumeCommands";

/** Pure: given the current snapshot and a command, returns the next snapshot. Returns the same
 * `snapshot` reference (not a copy) when the command is a no-op, so callers can cheaply check
 * `next === previous` to skip pushing an empty history entry. */
export function applyResumeCommand(snapshot: EditorSnapshot, command: ResumeCommand): EditorSnapshot {
  switch (command.type) {
    case "REPLACE_CONTENT":
    case "APPLY_TRIM":
    case "RESTORE_VERSION":
      if (command.content === snapshot.content) return snapshot;
      return { ...snapshot, content: command.content };

    case "REORDER_SECTION": {
      const order = snapshot.content.section_order ?? DEFAULT_RESUME_SECTION_ORDER;
      const nextOrder = moveItem(order, command.index, command.direction);
      if (nextOrder === order) return snapshot;
      return { ...snapshot, content: { ...snapshot.content, section_order: nextOrder } };
    }

    case "SET_TEMPLATE":
      return {
        ...snapshot,
        template: command.template,
        accentColor: command.accentColor !== undefined ? command.accentColor : snapshot.accentColor,
      };

    case "SET_ACCENT_COLOR":
      return { ...snapshot, accentColor: command.accentColor };

    case "SET_FONT_SIZE":
      return { ...snapshot, fontSizePt: command.fontSizePt };

    case "SET_FONT_CHOICE":
      return { ...snapshot, fontChoice: command.fontChoice };

    case "SET_MARGIN_PRESET":
      return { ...snapshot, marginPreset: command.marginPreset };

    case "SET_SPACING_PRESET":
      return { ...snapshot, spacingPreset: command.spacingPreset };

    case "SET_LINE_HEIGHT_PRESET":
      return { ...snapshot, lineHeightPreset: command.lineHeightPreset };

    default:
      return snapshot;
  }
}
