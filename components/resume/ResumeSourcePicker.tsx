"use client";

import type { ComponentType, SVGProps } from "react";
import { FilePenLineIcon, UploadIcon, UserIcon } from "@/components/ui/icons/LucideIcons";

export type ResumeSource = "profile" | "upload" | "scratch";

type Option = {
  source: ResumeSource;
  title: string;
  hint: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * What a general resume starts from, as three radio cards. Real radio inputs underneath, so arrow
 * keys move between them and screen readers announce a single choice.
 */
export function ResumeSourcePicker({
  value,
  onChange,
  profileReady,
  disabled = false,
}: {
  value: ResumeSource;
  onChange: (source: ResumeSource) => void;
  /** Whether the saved profile has enough to write from; changes the profile card's hint. */
  profileReady: boolean;
  disabled?: boolean;
}) {
  const options: Option[] = [
    {
      source: "profile",
      title: "My profile",
      hint: profileReady ? "Written from what you've saved" : "Needs a few details first",
      Icon: UserIcon,
    },
    { source: "upload", title: "Upload a resume", hint: "Opens your PDF or Word file as it is", Icon: UploadIcon },
    { source: "scratch", title: "Start from scratch", hint: "A blank resume you fill in", Icon: FilePenLineIcon },
  ];

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-2.5">
      <legend className="mb-2.5 text-[13px] font-semibold text-ink-secondary">Start from</legend>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {options.map(({ source, title, hint, Icon }) => {
          const selected = source === value;
          return (
            <label
              key={source}
              className={`group relative flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors duration-fast ease-editorial has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ${
                selected ? "border-accent bg-accent-soft/40" : "border-border bg-surface hover:border-border-strong"
              }`}
            >
              <input
                type="radio"
                name="resume-source"
                value={source}
                checked={selected}
                onChange={() => onChange(source)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-fast ease-editorial ${
                  selected ? "bg-accent-hover text-on-accent" : "bg-accent-soft text-accent-hover"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[14px] font-semibold text-ink">{title}</span>
                <span className="text-[13px] leading-snug text-ink-muted">{hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
