"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { Button } from "@/components/ui/Button";
import { ApplicationCard } from "@/components/applications/ApplicationCard";
import { ApplicationsListView } from "@/components/applications/ApplicationsListView";
import { AddApplicationModal } from "@/components/applications/AddApplicationModal";
import {
  PlusIcon,
  SearchIcon,
  LayoutGridIcon,
  ListIcon,
  TrendingUpIcon,
  BriefcaseIcon,
  MicIcon,
  CheckIcon,
  FilterIcon,
  XIcon,
} from "@/components/ui/icons/LucideIcons";
import { classifyInterviewingApplication } from "@/lib/dashboard/pipeline";
import { STATUS_OPTIONS } from "@/lib/applications/stageLabels";
import type { Application, ApplicationStatus, ApplicationInterview } from "@/types";

export type ResumeOption = { id: string; job_title: string | null; company_name: string | null };

const COLUMNS: {
  status: ApplicationStatus;
  label: string;
  dotColor: string;
  badgeBg: string;
}[] = [
  { status: "applied", label: "Applied", dotColor: "bg-slate-400", badgeBg: "bg-slate-100 text-slate-700" },
  { status: "interviewing", label: "Interviewing", dotColor: "bg-amber-500", badgeBg: "bg-amber-100 text-amber-800" },
  { status: "offer", label: "Offer", dotColor: "bg-emerald-500", badgeBg: "bg-emerald-100 text-emerald-800" },
  { status: "accepted", label: "Accepted", dotColor: "bg-teal-500", badgeBg: "bg-teal-100 text-teal-800" },
  { status: "rejected", label: "Rejected", dotColor: "bg-rose-400", badgeBg: "bg-rose-100 text-rose-700" },
  { status: "withdrawn", label: "Withdrawn", dotColor: "bg-neutral-400", badgeBg: "bg-neutral-100 text-neutral-600" },
];

export function ApplicationsBoard({
  initialApplications,
  resumes,
  initialInterviews = [],
}: {
  initialApplications: Application[];
  resumes: ResumeOption[];
  initialInterviews?: ApplicationInterview[];
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

  // High-Level Summary Stats (KPIs)
  const stats = useMemo(() => {
    const total = applications.length;
    const active = applications.filter((a) => a.status === "applied" || a.status === "interviewing" || a.status === "offer").length;
    const interviewing = applications.filter((a) => a.status === "interviewing").length;
    const offers = applications.filter((a) => a.status === "offer" || a.status === "accepted").length;

    // Count upcoming scheduled rounds
    const now = Date.now();
    const upcomingRounds = interviews.filter((i) => i.outcome === "scheduled" && new Date(i.scheduled_at).getTime() >= now - 60 * 60 * 1000);

    return {
      total,
      active,
      interviewing,
      offers,
      upcomingCount: upcomingRounds.length,
    };
  }, [applications, interviews]);

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
    setApplications((prev) => [newApp, ...prev]);
  }

  function clearStageFilter() {
    setSelectedStage("all");
    router.replace("/applications");
  }

  const visibleColumns = COLUMNS.filter((col) => {
    if (selectedStage === "all") return true;
    if (selectedStage === "screening" || selectedStage === "interview") {
      return col.status === "interviewing";
    }
    return col.status === selectedStage;
  });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* 1. High-Level Summary Stats (KPI Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Total Tracked */}
        <div className="flex flex-col justify-between rounded-xl border border-border/90 bg-surface p-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted">Total Tracked</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-paper-deep text-ink-muted">
              <BriefcaseIcon className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-xl font-bold text-ink">{stats.total}</span>
            <span className="text-[11px] text-ink-muted">applications</span>
          </div>
        </div>

        {/* Active Pipeline */}
        <div className="flex flex-col justify-between rounded-xl border border-border/90 bg-surface p-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted">Active Pipeline</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-100 text-accent">
              <TrendingUpIcon className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-xl font-bold text-accent">{stats.active}</span>
            <span className="text-[11px] text-ink-muted">in progress</span>
          </div>
        </div>

        {/* Scheduled Interviews */}
        <div className="flex flex-col justify-between rounded-xl border border-border/90 bg-surface p-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted">Interviews</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <MicIcon className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-xl font-bold text-amber-700">{stats.interviewing}</span>
            <span className="text-[11px] text-ink-muted">
              {stats.upcomingCount > 0 ? `${stats.upcomingCount} scheduled` : "active roles"}
            </span>
          </div>
        </div>

        {/* Offers & Wins */}
        <div className="flex flex-col justify-between rounded-xl border border-border/90 bg-surface p-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted">Offers & Wins</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-success">
              <CheckIcon className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-xl font-bold text-success">{stats.offers}</span>
            <span className="text-[11px] text-ink-muted">received</span>
          </div>
        </div>
      </div>

      {/* 2. Unified Toolbar (Actions, Search, View Toggle, Filter Pills) */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-border/80 bg-surface p-3 shadow-sm">
        {/* Top Row: Add Application + Search + View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Primary Add Button */}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => openAddModalForStatus("applied")}
              className="gap-1.5 shadow-sm"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Add application</span>
            </Button>

            {/* Search Bar */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-muted" />
              <input
                type="text"
                placeholder="Search company or job title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-border bg-paper py-1.5 pl-9 pr-8 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                  aria-label="Clear search"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* View Mode Switcher (Board vs List) */}
          <div className="flex items-center rounded-xl border border-border bg-paper p-1">
            <button
              type="button"
              onClick={() => setViewMode("board")}
              aria-label="Kanban board view"
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === "board"
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <LayoutGridIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="List table view"
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === "list"
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <ListIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Stage Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-ink-muted font-medium text-[11.5px] mr-1 flex items-center gap-1">
              <FilterIcon className="h-3 w-3" />
              Stage:
            </span>

            {/* "All" Filter Tab */}
            <button
              type="button"
              onClick={() => setSelectedStage("all")}
              className={`rounded-full px-3 py-1 font-medium text-xs transition-all ${
                selectedStage === "all"
                  ? "bg-ink text-surface shadow-sm"
                  : "bg-paper text-ink-secondary hover:bg-paper-deep hover:text-ink"
              }`}
            >
              All ({applications.length})
            </button>

            {/* Individual Stage Pills */}
            {COLUMNS.map((col) => {
              const count = applications.filter((a) => a.status === col.status).length;
              const isSelected = selectedStage === col.status;
              return (
                <button
                  key={col.status}
                  type="button"
                  onClick={() => setSelectedStage(col.status)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium text-xs transition-all ${
                    isSelected
                      ? "bg-ink text-surface shadow-sm"
                      : "bg-paper text-ink-secondary hover:bg-paper-deep hover:text-ink"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${col.dotColor}`} />
                  <span>{col.label}</span>
                  <span className={`text-[10px] ${isSelected ? "text-surface/80" : "text-ink-muted"}`}>
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* If deep-linked or filtered, offer quick reset button */}
          {selectedStage !== "all" && (
            <button
              type="button"
              onClick={clearStageFilter}
              className="text-xs font-medium text-accent hover:underline flex items-center gap-1"
            >
              <span>Show all columns</span>
              <XIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Main View: Kanban Board OR List Table */}
      {viewMode === "list" ? (
        filteredApplications.length > 0 ? (
          <ApplicationsListView
            applications={
              selectedStage === "all"
                ? filteredApplications
                : filteredApplications.filter((a) => {
                    if (selectedStage === "screening" || selectedStage === "interview") {
                      return (
                        a.status === "interviewing" &&
                        classifyInterviewingApplication(a.id, interviewsByAppId.get(a.id) ?? []) === selectedStage
                      );
                    }
                    return a.status === selectedStage;
                  })
            }
            resumes={resumes}
            interviewsByAppId={interviewsByAppId}
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
            <h3 className="mt-3 text-sm font-semibold text-ink">No applications found</h3>
            <p className="mt-1 max-w-sm text-xs text-ink-muted">
              {searchQuery
                ? `No applications matched "${searchQuery}". Try searching for something else.`
                : "Get started by adding your first job application to track its progress."}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => (searchQuery ? setSearchQuery("") : openAddModalForStatus("applied"))}
              className="mt-4"
            >
              {searchQuery ? "Clear search" : "+ Add application"}
            </Button>
          </div>
        )
      ) : (
        /* Kanban Board View */
        <div className="w-full min-w-0 overflow-x-auto pb-2 pt-1">
          <div
            className={`grid gap-2.5 sm:gap-3 items-start ${
              visibleColumns.length === 1 ? "max-w-md mx-auto" : ""
            }`}
            style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(150px, 1fr))` }}
          >
            {visibleColumns.map((column) => {
              const colApps = filteredApplications.filter((app) => {
                if (app.status !== column.status) return false;
                if (
                  column.status === "interviewing" &&
                  (selectedStage === "screening" || selectedStage === "interview")
                ) {
                  return (
                    classifyInterviewingApplication(app.id, interviewsByAppId.get(app.id) ?? []) === selectedStage
                  );
                }
                return true;
              });

              return (
                <div
                  key={column.status}
                  className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-border/70 bg-paper/70 p-2.5 shadow-sm"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between gap-1 px-1 py-0.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${column.dotColor}`} />
                      <h2 className="truncate text-xs font-bold uppercase tracking-wider text-ink">
                        {column.status === "interviewing" && selectedStage === "screening"
                          ? "Screening"
                          : column.status === "interviewing" && selectedStage === "interview"
                          ? "Interview"
                          : column.label}
                      </h2>
                      <span className="flex h-5 shrink-0 items-center justify-center rounded-full bg-paper-deep px-2 text-[11px] font-semibold text-ink-secondary">
                        {colApps.length}
                      </span>
                    </div>

                    {/* Quick Add Button in column header */}
                    <button
                      type="button"
                      onClick={() => openAddModalForStatus(column.status)}
                      title={`Add application to ${column.label}`}
                      aria-label={`Add application to ${column.label}`}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Column Cards Container */}
                  <div className="flex flex-col gap-2 min-h-[100px]">
                    {colApps.map((application) => (
                      <ApplicationCard
                        key={application.id}
                        application={application}
                        resumes={resumes}
                        interviews={interviewsByAppId.get(application.id) ?? []}
                        onUpdated={handleUpdated}
                        onStatusRollback={handleStatusRollback}
                        onDeleted={handleDeleted}
                        onInterviewsUpdated={handleInterviewsUpdated}
                      />
                    ))}

                    {/* Empty Column State */}
                    {colApps.length === 0 && (
                      <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border/50 p-4 text-center">
                        <span className="text-[11px] text-ink-muted/80">
                          No applications
                        </span>
                        <button
                          type="button"
                          onClick={() => openAddModalForStatus(column.status)}
                          className="text-xs font-semibold text-accent hover:underline"
                        >
                          + Add role
                        </button>
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
        onClose={() => setIsAddModalOpen(false)}
        onCreated={handleApplicationCreated}
        resumes={resumes}
        defaultStatus={addModalDefaultStatus}
      />
    </div>
  );
}
