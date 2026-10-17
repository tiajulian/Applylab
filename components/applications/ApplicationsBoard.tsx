"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { Button } from "@/components/ui/Button";
import { ApplicationCard } from "@/components/applications/ApplicationCard";
import type { PracticeSummary } from "@/lib/interview/history";
import { ApplicationsListView } from "@/components/applications/ApplicationsListView";
import { AddApplicationModal } from "@/components/applications/AddApplicationModal";
import {
  PlusIcon,
  SearchIcon,
  LayoutGridIcon,
  ListIcon,
  BriefcaseIcon,
  XIcon,
} from "@/components/ui/icons/LucideIcons";
import { classifyInterviewingApplication } from "@/lib/dashboard/pipeline";
import { STATUS_LABELS } from "@/lib/applications/stageLabels";
import { useQueryFlag } from "@/lib/hooks/useQueryFlag";
import { dropSearchParam } from "@/lib/url/dropSearchParam";
import type { Application, ApplicationStatus, ApplicationInterview } from "@/types";

export type ResumeOption = { id: string; job_title: string | null; company_name: string | null };

type ColumnKey = "applied" | "interviewing" | "offer" | "finished";

const COLUMNS: {
  key: ColumnKey;
  statuses: ApplicationStatus[];
  label: string;
  hint: string;
  dotColor: string;
}[] = [
  { key: "applied", statuses: ["applied"], label: "Applied", hint: "Waiting to hear back", dotColor: "bg-ink-muted" },
  { key: "interviewing", statuses: ["interviewing"], label: "Interviewing", hint: "You're talking to them", dotColor: "bg-attention" },
  { key: "offer", statuses: ["offer"], label: "Offer", hint: "They want you", dotColor: "bg-success" },
  {
    key: "finished",
    statuses: ["accepted", "rejected", "withdrawn"],
    label: "Finished",
    hint: "Accepted, not successful or withdrawn",
    dotColor: "bg-border-strong",
  },
];

/** Which board column a deep-linked ?stage= value (dashboard tiles, old links) belongs to. */
function columnForStage(stage: string): ColumnKey | "all" {
  if (stage === "screening" || stage === "interview") return "interviewing";
  const column = COLUMNS.find((col) => col.key === stage || col.statuses.includes(stage as ApplicationStatus));
  return column?.key ?? "all";
}

export function ApplicationsBoard({
  initialApplications,
  resumes,
  initialInterviews = [],
  practiceByApp = {},
}: {
  initialApplications: Application[];
  resumes: ResumeOption[];
  initialInterviews?: ApplicationInterview[];
  /** Finished interview practice per application id. */
  practiceByApp?: Record<string, PracticeSummary>;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialStageFilter = searchParams?.get("stage") ?? "all";

  const [applications, setApplications] = useState(initialApplications);
  const [interviews, setInterviews] = useState(initialInterviews);
  const [selectedStage, setSelectedStage] = useState<string>(initialStageFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");

  // Board mode needs room for all stage columns; default narrow viewports to List instead.
  const isMobile = useIsMobile();
  useEffect(() => {
    if (isMobile) {
      setViewMode("list");
    }
  }, [isMobile]);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  // ?add=1 (the dashboard's "Add a job" shortcut) opens the form; &resume=<id> (the editor's
  // "I applied for this") picks that resume in it.
  const [addModalResumeId, setAddModalResumeId] = useState<string | undefined>();
  useQueryFlag("add", () => {
    setAddModalResumeId(searchParams.get("resume") ?? undefined);
    dropSearchParam("resume");
    setIsAddModalOpen(true);
  });
  const [addModalDefaultStatus, setAddModalDefaultStatus] = useState<ApplicationStatus>("applied");

  const interviewsByAppId = useMemo(() => {
    const map = new Map<string, ApplicationInterview[]>();
    for (const interview of interviews) {
      const list = map.get(interview.application_id) ?? [];
      list.push(interview);
      map.set(interview.application_id, list);
    }
    return map;
  }, [interviews]);

  // Filter applications by search query
  const filteredApplications = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return applications;
    return applications.filter(
      (app) =>
        app.company_name.toLowerCase().includes(query) ||
        app.job_title.toLowerCase().includes(query) ||
        (app.notes && app.notes.toLowerCase().includes(query))
    );
  }, [applications, searchQuery]);

  function handleUpdated(updated: Application) {
    setApplications((prev) =>
      prev.map((application) => (application.id === updated.id ? updated : application))
    );
  }

  function handleStatusRollback(
    id: string,
    expectedStatus: ApplicationStatus,
    revertTo: Application
  ) {
    setApplications((prev) =>
      prev.map((application) =>
        application.id === id && application.status === expectedStatus ? revertTo : application
      )
    );
  }

  function handleDeleted(id: string) {
    setApplications((prev) => prev.filter((application) => application.id !== id));
    setInterviews((prev) => prev.filter((interview) => interview.application_id !== id));
  }

  function handleInterviewsUpdated(applicationId: string, updatedList: ApplicationInterview[]) {
    setInterviews((prev) => {
      const others = prev.filter((i) => i.application_id !== applicationId);
      return [...others, ...updatedList];
    });
  }

  function openAddModalForStatus(status: ApplicationStatus = "applied") {
    setAddModalDefaultStatus(status);
    setIsAddModalOpen(true);
  }

  function handleApplicationCreated(newApp: Application) {
    // The API returns the existing application when the job link is already tracked: update it
    // where it is rather than moving it to the top as if it were new.
    setApplications((prev) =>
      prev.some((app) => app.id === newApp.id)
        ? prev.map((app) => (app.id === newApp.id ? newApp : app))
        : [newApp, ...prev]
    );
  }

  function clearStageFilter() {
    setSelectedStage("all");
    router.replace("/applications");
  }

  const selectedColumn = columnForStage(selectedStage);
  const visibleColumns = selectedColumn === "all" ? COLUMNS : COLUMNS.filter((col) => col.key === selectedColumn);

  /** Narrows to the deep-linked stage: a single status, or phone screen vs interview rounds. */
  function matchesSelectedStage(app: Application): boolean {
    if (selectedStage === "screening" || selectedStage === "interview") {
      return (
        app.status === "interviewing" &&
        classifyInterviewingApplication(app.id, interviewsByAppId.get(app.id) ?? []) === selectedStage
      );
    }
    if (selectedColumn === "all") return true;
    if (selectedStage === selectedColumn) {
      return COLUMNS.find((col) => col.key === selectedColumn)!.statuses.includes(app.status);
    }
    return app.status === selectedStage;
  }

  const stageFiltered = filteredApplications.filter(matchesSelectedStage);
  // e.g. ?stage=screening from the dashboard: narrower than its column, so say what's showing.
  const subStageLabel =
    selectedColumn !== "all" && selectedStage !== selectedColumn
      ? selectedStage === "screening"
        ? "phone screens"
        : selectedStage === "interview"
        ? "interviews"
        : STATUS_LABELS[selectedStage as ApplicationStatus]?.toLowerCase()
      : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button type="button" onClick={() => openAddModalForStatus("applied")} className="gap-1.5">
            <PlusIcon className="h-4 w-4" />
            Add a job you applied for
          </Button>

          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              aria-label="Search your applications"
              placeholder="Search by company or job"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-pill border border-border bg-surface pl-10 pr-9 text-[15px] text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 sm:text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                aria-label="Clear search"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="ml-auto hidden items-center rounded-pill border border-border bg-surface p-1 sm:flex" role="group" aria-label="Layout">
            {([
              { mode: "board", label: "Columns", Icon: LayoutGridIcon },
              { mode: "list", label: "List", Icon: ListIcon },
            ] as const).map(({ mode, label, Icon }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                aria-pressed={viewMode === mode}
                className={`flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[13px] font-medium transition-colors duration-fast ${
                  viewMode === mode ? "bg-paper-deep text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {applications.length > 0 && (
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Show">
            {[
              { key: "all" as const, label: "All", count: applications.length, dot: null },
              ...COLUMNS.map((col) => ({
                key: col.key,
                label: col.label,
                count: applications.filter((a) => col.statuses.includes(a.status)).length,
                dot: col.dotColor,
              })),
            ]
              .filter((pill) => pill.key === "all" || pill.count > 0 || pill.key === selectedColumn)
              .map((pill) => {
                const isSelected = selectedColumn === pill.key;
                return (
                  <button
                    key={pill.key}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => (pill.key === "all" ? clearStageFilter() : setSelectedStage(pill.key))}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-[13.5px] font-medium transition-colors duration-fast ${
                      isSelected
                        ? "border-ink bg-ink text-surface"
                        : "border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink"
                    }`}
                  >
                    {pill.dot && <span aria-hidden="true" className={`h-2 w-2 rounded-full ${pill.dot}`} />}
                    {pill.label}
                    <span className={`tabular-nums ${isSelected ? "text-surface/70" : "text-ink-muted"}`}>{pill.count}</span>
                  </button>
                );
              })}
          </div>
        )}

        {subStageLabel && (
          <p className="flex flex-wrap items-center gap-2 text-[13.5px] text-ink-secondary">
            Showing only {subStageLabel} ({stageFiltered.length}).
            <button type="button" onClick={clearStageFilter} className="font-semibold text-accent-hover hover:underline">
              Show all
            </button>
          </p>
        )}
      </div>

      {/* 3. Main View: Kanban Board OR List Table */}
      {viewMode === "list" ? (
        stageFiltered.length > 0 ? (
          <ApplicationsListView
            applications={stageFiltered}
            resumes={resumes}
            interviewsByAppId={interviewsByAppId}
            practiceByApp={practiceByApp}
            onUpdated={handleUpdated}
            onStatusRollback={handleStatusRollback}
            onDeleted={handleDeleted}
            onInterviewsUpdated={handleInterviewsUpdated}
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-paper-deep text-ink-muted">
              <BriefcaseIcon className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-[15px] font-semibold text-ink">{searchQuery ? "Nothing found" : "No jobs here yet"}</h3>
            <p className="mt-1 max-w-sm text-[13.5px] text-ink-secondary">
              {searchQuery
                ? `No applications matched "${searchQuery}". Try searching for something else.`
                : "Applied for a job? Add it here so you can keep track of replies and interviews."}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => (searchQuery ? setSearchQuery("") : openAddModalForStatus("applied"))}
              className="mt-4"
            >
              {searchQuery ? "Clear search" : "+ Add a job"}
            </Button>
          </div>
        )
      ) : (
        /* Kanban Board View */
        <div className="w-full min-w-0 overflow-x-auto pb-2 pt-1">
          <div
            className={`grid gap-2.5 sm:gap-3 items-start ${
              visibleColumns.length === 1 ? "w-fit max-w-md mx-auto" : ""
            }`}
            style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(260px, 1fr))` }}
          >
            {visibleColumns.map((column) => {
              const colApps = stageFiltered.filter((app) => column.statuses.includes(app.status));
              const addStatus = column.statuses[0];

              return (
                <div
                  key={column.key}
                  className="flex min-w-0 flex-col gap-2.5 rounded-lg bg-paper-deep/70 p-3"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between gap-1 px-1 py-0.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${column.dotColor}`} />
                      <h2 className="truncate text-[14px] font-semibold text-ink">
                        {column.key === "interviewing" && selectedStage === "screening"
                          ? "Phone screen"
                          : column.key === "interviewing" && selectedStage === "interview"
                          ? "Interview"
                          : column.label}
                      </h2>
                      <span className="flex h-5 shrink-0 items-center justify-center rounded-full bg-paper-deep px-2 text-[11px] font-semibold text-ink-secondary">
                        {colApps.length}
                      </span>
                    </div>

                    {column.key !== "finished" && (
                    <button
                      type="button"
                      onClick={() => openAddModalForStatus(addStatus)}
                      title={`Add a job to ${column.label}`}
                      aria-label={`Add a job to ${column.label}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface hover:text-ink"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                    )}
                  </div>
                  <p className="-mt-1.5 px-1 text-[12.5px] text-ink-muted">{column.hint}</p>

                  {/* Column Cards Container */}
                  <div className="flex flex-col gap-2 min-h-[100px]">
                    {colApps.map((application) => (
                      <ApplicationCard
                        key={application.id}
                        application={application}
                        resumes={resumes}
                        interviews={interviewsByAppId.get(application.id) ?? []}
                        practice={practiceByApp[application.id]}
                        onUpdated={handleUpdated}
                        onStatusRollback={handleStatusRollback}
                        onDeleted={handleDeleted}
                        onInterviewsUpdated={handleInterviewsUpdated}
                      />
                    ))}

                    {/* Empty Column State */}
                    {colApps.length === 0 && (
                      <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-border-strong/60 p-4 text-center">
                        <span className="text-[13px] text-ink-muted">Nothing here yet</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Application Modal */}
      <AddApplicationModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddModalResumeId(undefined);
        }}
        onCreated={handleApplicationCreated}
        resumes={resumes}
        defaultResumeId={addModalResumeId}
        defaultStatus={addModalDefaultStatus}
      />
    </div>
  );
}
