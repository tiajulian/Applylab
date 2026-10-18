import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  WandSparklesIcon,
  FileTextIcon,
  MessageSquareIcon,
  BriefcaseIcon,
  DownloadIcon,
} from "@/components/ui/icons/LucideIcons";
import { BRAND } from "@/lib/marketing/copy";

export const metadata = {
  title: "Chrome extension",
  description: "Download and install the ApplyLab Chrome extension, which fills in job application forms for you.",
};

const STEPS = [
  {
    title: "Download the extension",
    body: (
      <>
        Press <strong className="font-semibold text-ink">Download</strong> above. Open the file you get and
        unzip it into a folder you can find again.
      </>
    ),
  },
  {
    title: "Open Chrome's extensions page",
    body: (
      <>
        In Google Chrome, type{" "}
        <code className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[13px] text-ink">chrome://extensions</code>{" "}
        into the address bar. Turn on <strong className="font-semibold text-ink">Developer mode</strong> (top right).
      </>
    ),
  },
  {
    title: "Add ApplyLab",
    body: (
      <>
        Press <strong className="font-semibold text-ink">Load unpacked</strong> (top left) and choose the folder you
        unzipped.
      </>
    ),
  },
  {
    title: "Apply for a job",
    body: (
      <>
        Stay signed in to ApplyLab in Chrome. On a job application page, look for the{" "}
        <span className="inline-flex items-center gap-1 font-semibold text-ink">
          <WandSparklesIcon className="h-3.5 w-3.5" /> Autofill
        </span>{" "}
        button in the bottom-right corner.
      </>
    ),
  },
];

const FEATURES = [
  {
    icon: WandSparklesIcon,
    title: "Fills in your details",
    body: "Your name, email, mobile, suburb, state, postcode and work rights, in the right boxes.",
  },
  {
    icon: FileTextIcon,
    title: "Attaches your resume",
    body: "Adds your tailored resume to the upload box for you.",
  },
  {
    icon: MessageSquareIcon,
    title: "Helps with screening questions",
    body: "Suggests an answer to written questions, based on your profile.",
  },
  {
    icon: BriefcaseIcon,
    title: "Saves the job to your list",
    body: "Adds the job you're applying for to your Applications in one click, from any job site. If it can't read the job title or company from the page, it asks you.",
  },
];

export default function ExtensionPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <PageHeader
        title="Chrome extension"
        subtitle={`${BRAND.extension} On other job sites it fills in what it can. It's free.`}
        action={
          <Button href="/api/extension/download" download="applylab-extension.zip" size="lg">
            <DownloadIcon className="h-4 w-4" /> Download
          </Button>
        }
      />

      <section aria-labelledby="what-it-does" className="flex flex-col gap-4">
        <h2 id="what-it-does" className="text-[18px] font-semibold text-ink">
          What it does
        </h2>
        <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3.5">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-hover"
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-ink">{title}</span>
                <span className="mt-0.5 block text-[14px] leading-relaxed text-ink-secondary">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="install"
        className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="install" className="text-[18px] font-semibold text-ink">
              How to install it
            </h2>
            <span className="rounded-pill bg-attention-soft px-2.5 py-0.5 text-[12px] font-semibold text-ink">
              Beta · for confident computer users
            </span>
          </div>
          <p className="mt-1 text-[14px] text-ink-secondary">
            Takes about 2 minutes, on a computer with Google Chrome. It isn&apos;t in the Chrome Web Store yet, so
            you add it by hand using Chrome&apos;s developer mode. If that sounds like too much, skip it: everything
            else in ApplyLab works without it.
          </p>
        </div>
        <ol className="flex flex-col gap-5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-hover text-[14px] font-bold text-on-accent"
              >
                {i + 1}
              </span>
              <div className="pt-0.5">
                <h3 className="text-[15.5px] font-semibold text-ink">{step.title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-secondary">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="rounded-md bg-paper-deep/70 p-4 text-[14px] leading-relaxed text-ink-secondary">
          <p className="font-semibold text-ink">About Chrome&apos;s warning</p>
          <p className="mt-1">
            Because it&apos;s added by hand, Chrome may show &ldquo;Disable developer mode extensions&rdquo; when it
            starts. Chrome says this for every extension added outside the Web Store, not just ApplyLab. Close the
            message to keep using it. The extension only reads the job page you&apos;re on and your ApplyLab
            profile, and it never submits an application for you.
          </p>
        </div>
      </section>
    </div>
  );
}
