"use client";

import { forwardRef } from "react";
import { CatalogInput, type CatalogInputProps } from "@/components/ui/CatalogInput";
import { JOB_TITLE_CATALOG } from "@/lib/jobs/jobTitleCatalog";

/** A free-text job title field that suggests common titles as you type ("data an" -> "Data Analyst"). */
export const JobTitleInput = forwardRef<HTMLInputElement, Omit<CatalogInputProps, "catalog">>((props, ref) => (
  <CatalogInput ref={ref} {...props} catalog={JOB_TITLE_CATALOG} />
));

JobTitleInput.displayName = "JobTitleInput";
