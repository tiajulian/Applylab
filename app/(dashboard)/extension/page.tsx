import Link from "next/link";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "Chrome Extension | ApplyLab",
  description: "Download and install the ApplyLab Auto-Apply & Form Co-Pilot Chrome Extension.",
};

export default function ExtensionPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 py-4">
      {/* Header Banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-8 text-center sm:text-left">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              🦘 Beta Release v1.0.0
            </span>
            <h1 className="mt-3 font-display text-h2 text-ink">
              ApplyLab Job Application Co-Pilot
            </h1>
            <p className="mt-2 text-sm text-ink-secondary">
              Autofill job applications across SEEK, LinkedIn, Workday, PageUp & LiveHire with 1 click.
            </p>
          </div>
          <a
            href="/downloads/applylab-extension.zip"
            download="applylab-extension.zip"
            className="shrink-0"
          >
            <Button size="lg" className="gap-2 shadow-md">
              🧩 Download Extension ZIP
            </Button>
          </a>
        </div>
      </div>

      {/* 3-Step Setup Instructions */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-h3 text-ink">
          ⚡ 3-Step Installation Guide (Developer Mode)
        </h2>
        <div className="mt-6 flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white">
              1
            </div>
            <div>
              <h3 className="font-semibold text-ink">Download & Extract ZIP</h3>
              <p className="mt-1 text-sm text-ink-secondary">
                Click the download button above to save <code className="rounded bg-paper px-1.5 py-0.5 text-xs text-primary font-mono">applylab-extension.zip</code>, then unzip it to a folder on your computer.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white">
              2
            </div>
            <div>
              <h3 className="font-semibold text-ink">Open Chrome Extensions</h3>
              <p className="mt-1 text-sm text-ink-secondary">
                Open Google Chrome, type <code className="rounded bg-paper px-1.5 py-0.5 text-xs text-ink font-mono">chrome://extensions</code> into the address bar, and turn on the <span className="font-semibold text-ink">Developer mode</span> toggle in the top-right corner.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white">
              3
            </div>
            <div>
              <h3 className="font-semibold text-ink">Load Unpacked Extension</h3>
              <p className="mt-1 text-sm text-ink-secondary">
                Click the <span className="font-semibold text-ink">&quot;Load unpacked&quot;</span> button in the top-left corner and select the extracted extension folder.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Overview */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5">
          <h3 className="font-semibold text-ink">⚡ 1-Click Form Autofill</h3>
          <p className="mt-1.5 text-xs text-ink-secondary">
            Automatically fills First/Last Name, Email, Australian Mobile (<code className="text-xs font-mono">04xx xxx xxx</code>), Suburb, State, Postcode, and Work Rights.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <h3 className="font-semibold text-ink">📄 Direct PDF Attachment</h3>
          <p className="mt-1.5 text-xs text-ink-secondary">
            Injects your active tailored resume binary directly into portal file upload inputs using the DataTransfer API.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <h3 className="font-semibold text-ink">🪄 AI Screening Answer Assistant</h3>
          <p className="mt-1.5 text-xs text-ink-secondary">
            Click the inline AI button next to textareas to generate tailored STAR-method responses to screening questions.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <h3 className="font-semibold text-ink">📊 1-Click Kanban Logging</h3>
          <p className="mt-1.5 text-xs text-ink-secondary">
            Scrapes Job Title, Company, Location, and URL from SEEK & LinkedIn to log applications directly to your ApplyLab dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
