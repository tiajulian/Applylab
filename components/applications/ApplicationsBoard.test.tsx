import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApplicationsBoard } from "./ApplicationsBoard";
import { ApplicationCard } from "./ApplicationCard";
import { ApplicationsListView } from "./ApplicationsListView";
import { AddApplicationModal } from "./AddApplicationModal";
import type { Application, ApplicationInterview } from "@/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

const mockApplications: Application[] = [
  {
    id: "app-1",
    user_id: "user-1",
    resume_id: "res-1",
    company_name: "Canva",
    job_title: "Senior Product Designer",
    status: "interviewing",
    applied_date: "2026-08-20",
    job_url: "https://canva.com/jobs/123",
    notes: "Interview with head of design",
    created_at: "2026-08-20T00:00:00Z",
    updated_at: "2026-08-20T00:00:00Z",
  },
  {
    id: "app-2",
    user_id: "user-1",
    resume_id: null,
    company_name: "Atlassian",
    job_title: "Full Stack Engineer",
    status: "applied",
    applied_date: "2026-08-22",
    job_url: null,
    notes: null,
    created_at: "2026-08-22T00:00:00Z",
    updated_at: "2026-08-22T00:00:00Z",
  },
  {
    id: "app-3",
    user_id: "user-1",
    resume_id: null,
    company_name: "Google",
    job_title: "Staff Engineer",
    status: "offer",
    applied_date: "2026-08-15",
    job_url: null,
    notes: null,
    created_at: "2026-08-15T00:00:00Z",
    updated_at: "2026-08-15T00:00:00Z",
  },
];

const mockInterviews: ApplicationInterview[] = [
  {
    id: "int-1",
    application_id: "app-1",
    stage_type: "technical",
    scheduled_at: "2026-09-25T10:00:00Z",
    is_deadline: false,
    location: "Google Meet",
    notes: "System design round",
    outcome: "scheduled",
    created_at: "2026-08-20T00:00:00Z",
    updated_at: "2026-08-20T00:00:00Z",
  },
];

const mockResumes = [
  { id: "res-1", job_title: "Product Designer", company_name: "Canva" },
];

describe("Applications UI Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ApplicationsBoard", () => {
    it("renders KPI summary metrics accurately", () => {
      const markup = renderToStaticMarkup(
        createElement(ApplicationsBoard, {
          initialApplications: mockApplications,
          resumes: mockResumes,
          initialInterviews: mockInterviews,
        })
      );

      // KPI cards
      expect(markup).toContain("Total Tracked");
      expect(markup).toContain("Active Pipeline");
      expect(markup).toContain("Interviews");
      expect(markup).toContain("Offers &amp; Wins");

      // Total count = 3
      expect(markup).toContain("3");
    });

    it("renders search input, view switcher, and stage filter tabs", () => {
      const markup = renderToStaticMarkup(
        createElement(ApplicationsBoard, {
          initialApplications: mockApplications,
          resumes: mockResumes,
          initialInterviews: mockInterviews,
        })
      );

      expect(markup).toContain('placeholder="Search company or job title..."');
      expect(markup).toContain("Board");
      expect(markup).toContain("List");
      expect(markup).toContain("Add application");
      expect(markup).toContain("All (3)");
      expect(markup).toContain("Applied");
      expect(markup).toContain("Interviewing");
      expect(markup).toContain("Offer");
    });

    it("renders Kanban columns with stage headers and cards", () => {
      const markup = renderToStaticMarkup(
        createElement(ApplicationsBoard, {
          initialApplications: mockApplications,
          resumes: mockResumes,
          initialInterviews: mockInterviews,
        })
      );

      expect(markup).toContain("Senior Product Designer");
      expect(markup).toContain("Canva");
      expect(markup).toContain("Full Stack Engineer");
      expect(markup).toContain("Atlassian");
      expect(markup).toContain("Staff Engineer");
      expect(markup).toContain("Google");
    });
  });

  describe("ApplicationCard", () => {
    it("renders company initials monogram and role title", () => {
      const markup = renderToStaticMarkup(
        createElement(ApplicationCard, {
          application: mockApplications[0],
          resumes: mockResumes,
          interviews: mockInterviews,
          onUpdated: () => {},
          onStatusRollback: () => {},
          onDeleted: () => {},
        })
      );

      expect(markup).toContain("CA"); // Canva initials
      expect(markup).toContain("Senior Product Designer");
      expect(markup).toContain("Canva");
      expect(markup).toContain("Interviewing");
    });

    it("renders scheduled interview details and format type", () => {
      const markup = renderToStaticMarkup(
        createElement(ApplicationCard, {
          application: mockApplications[0],
          resumes: mockResumes,
          interviews: mockInterviews,
          onUpdated: () => {},
          onStatusRollback: () => {},
          onDeleted: () => {},
        })
      );

      expect(markup).toContain("Technical &amp; practical");
      expect(markup).toContain("📍 Google Meet");
    });

    it("renders listing link and practice interview CTA", () => {
      const markup = renderToStaticMarkup(
        createElement(ApplicationCard, {
          application: mockApplications[0],
          resumes: mockResumes,
          interviews: mockInterviews,
          onUpdated: () => {},
          onStatusRollback: () => {},
          onDeleted: () => {},
        })
      );

      expect(markup).toContain("Listing");
      expect(markup).toContain("https://canva.com/jobs/123");
      expect(markup).toContain("🎙️ Practise");
      expect(markup).toContain("/interview?application=app-1");
    });
  });

  describe("ApplicationsListView", () => {
    it("renders applications in high-density table structure", () => {
      const interviewsMap = new Map();
      interviewsMap.set("app-1", mockInterviews);

      const markup = renderToStaticMarkup(
        createElement(ApplicationsListView, {
          applications: mockApplications,
          resumes: mockResumes,
          interviewsByAppId: interviewsMap,
          onUpdated: () => {},
          onStatusRollback: () => {},
          onDeleted: () => {},
        })
      );

      expect(markup).toContain("<table");
      expect(markup).toContain("Role &amp; Company");
      expect(markup).toContain("Stage");
      expect(markup).toContain("Next Round / Schedule");
      expect(markup).toContain("Applied");
      expect(markup).toContain("Actions");
      expect(markup).toContain("Senior Product Designer");
      expect(markup).toContain("Atlassian");
      expect(markup).toContain("Google");
    });
  });

  describe("AddApplicationModal", () => {
    it("renders dialog with accessible landmarks when open", () => {
      const markup = renderToStaticMarkup(
        createElement(AddApplicationModal, {
          isOpen: true,
          onClose: () => {},
          onCreated: () => {},
          resumes: mockResumes,
        })
      );

      expect(markup).toContain('role="dialog"');
      expect(markup).toContain('aria-modal="true"');
      expect(markup).toContain('id="modalCompanyName"');
      expect(markup).toContain('id="modalJobTitle"');
      expect(markup).toContain('id="modalStatus"');
      expect(markup).toContain("Autofill from tailored resume");
    });

    it("returns empty markup when closed", () => {
      const markup = renderToStaticMarkup(
        createElement(AddApplicationModal, {
          isOpen: false,
          onClose: () => {},
          onCreated: () => {},
          resumes: mockResumes,
        })
      );

      expect(markup).toBe("");
    });
  });
});
