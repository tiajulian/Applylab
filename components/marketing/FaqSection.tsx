"use client";

import { BRAND } from "@/lib/marketing/copy";
import { FREE_INTERVIEW_LABEL, FREE_RESUMES_LABEL, SINGLE_UNLOCK } from "@/lib/marketing/plans";
import { FREE_INTERVIEW_ALLOWANCE } from "@/lib/interview/setupConstants";
import { ChevronDownIcon } from "@/components/ui/icons/LucideIcons";

const FAQS = [
  {
    q: "Will ApplyLab ever invent experience to match a job ad?",
    a: "No. Every resume is written from your profile, a one-time record of your experience. Anything the job asks for that isn't in your profile is shown as a gap, not added.",
  },
  {
    q: "How does interview practice work?",
    a: `Pick a job you've tailored a resume for (on Pro you can also upload any resume). ApplyLab builds questions from the job ad and your resume, then asks them one at a time. Answer out loud or by typing. After each answer you get a score, what worked, and a stronger way to say it. At the end you get a full report. Your first practice is free (${FREE_INTERVIEW_ALLOWANCE.questionCount} questions).`,
  },
  {
    q: "What if I don't have numbers for my achievements?",
    a: "Most people have more than they think. ApplyLab asks simple questions like how much time something saved, how many people it involved, or what got easier, to help you find them. If there's no number, a clear description of the outcome is still strong. We never add a number you didn't give us.",
  },
  {
    q: "Is ApplyLab made for Australian jobs?",
    a: "Yes. Resumes use Australian English, the 04xx phone format and your work rights, and are built for SEEK and other Australian job sites.",
  },
  {
    q: "What does the Chrome extension do?",
    a: `${BRAND.extension} It can also save the job to your application tracker.`,
  },
  {
    q: "What happens to my data?",
    a: "Your data is never sold or used to train AI models. The extension never submits an application for you. You can delete your account at any time.",
  },
  {
    q: "What do I get on the free plan?",
    a: `${FREE_RESUMES_LABEL} ready to download, a free resume score, ${FREE_INTERVIEW_LABEL}, all 8 templates, the application tracker and the Chrome extension. No credit card needed. Downloading more resumes needs Pro or a one-off ${SINGLE_UNLOCK.priceLabel} unlock.`,
  },
];

export function FaqSection() {
  return (
    <section className="section" id="faq">
      <div className="container center">
        <h2 className="reveal" style={{ margin: "0 0 4px" }}>
          Questions, answered honestly.
        </h2>
        <div className="faq reveal" style={{ textAlign: "left" }}>
          {FAQS.map((item, i) => (
            <details key={item.q} className="qa" open={i === 0}>
              <summary>
                {item.q}{" "}
                <span className="chev" aria-hidden="true">
                  <ChevronDownIcon className="h-[18px] w-[18px]" />
                </span>
              </summary>
              <div className="body">
                <div>
                  <p>{item.a}</p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
