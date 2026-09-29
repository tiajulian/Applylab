"use client";

import { forwardRef } from "react";
import { SuggestInput, type SuggestInputProps } from "@/components/ui/SuggestInput";
import { suggestJobTitles } from "@/lib/jobs/jobTitleCatalog";

/** A free-text job title field that suggests common titles as you type ("data an" -> "Data Analyst"). */
export const JobTitleInput = forwardRef<HTMLInputElement, Omit<SuggestInputProps, "suggest">>((props, ref) => (
  <SuggestInput ref={ref} {...props} suggest={suggestJobTitles} />
));

JobTitleInput.displayName = "JobTitleInput";
