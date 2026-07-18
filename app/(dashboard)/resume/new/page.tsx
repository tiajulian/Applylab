import { ResumeForm } from "@/components/resume/ResumeForm";

export default function NewResumePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">New resume</h1>
        <p className="mt-1 text-sm text-gray-500">
          Paste the job ad and we&apos;ll tailor an ATS-safe, SEEK-ready resume from your profile.
        </p>
      </div>
      <ResumeForm />
    </div>
  );
}
