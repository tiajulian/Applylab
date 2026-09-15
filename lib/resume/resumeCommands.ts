import type { FontSizePt } from "@/lib/resume/templateDensity";
import type { CanonicalTemplate, ResumeContent, Template } from "@/types";

// Everything that must move together through one undo/redo step: the resume content plus the
// per-resume presentation choices (template/accent/font) that the toolbar also controls. One
// envelope, not parallel reducers, so e.g. undoing a template switch can never leave content and
// template out of sync with each other.
export interface EditorSnapshot {
  content: ResumeContent;
  template: Template;
  accentColor: string | null;
  fontSizePt: FontSizePt;
}

// Coarse by design: the accordion form already computes the full next ResumeContent itself
// (see ResumeEditorForm.tsx's updateContact/updateExperience/etc.), so REPLACE_CONTENT just
// carries that result rather than re-deriving it from a per-field command type. The remaining
// variants are the discrete toolbar actions, which do need to compute their own next state since
// nothing upstream has already done it for them.
export type ResumeCommand =
  | { type: "REPLACE_CONTENT"; content: ResumeContent }
  | { type: "REORDER_SECTION"; index: number; direction: -1 | 1 }
  | { type: "SET_TEMPLATE"; template: CanonicalTemplate; accentColor?: string | null }
  | { type: "SET_ACCENT_COLOR"; accentColor: string | null }
  | { type: "SET_FONT_SIZE"; fontSizePt: FontSizePt }
  | { type: "APPLY_TRIM"; content: ResumeContent }
  | { type: "RESTORE_VERSION"; content: ResumeContent };
